package org.cfdna.database.service;

import org.cfdna.database.dto.VafBodyMapDto;
import org.cfdna.database.dto.VafBodyMapEntryDto;
import org.cfdna.database.dto.VafBoxStatsDto;
import org.cfdna.database.dto.VafBoxplotDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class VafAnalysisService {
    private static final long BODY_MAP_CACHE_TTL_MS = 10 * 60_000L;

    private static final Map<String, String> CANCER_TYPE_ALIASES = Map.ofEntries(
            Map.entry("Colonrector", "Colorectal"),
            Map.entry("Endometrium", "Endometrial"),
            Map.entry("Experiment", "Gastric"),
            Map.entry("Head_and_Neck", "HeadAndNeck"),
            Map.entry("NGY", "Benign_Tumor"),
            Map.entry("Pdac", "Pancreatic"),
            Map.entry("Thyriod", "Thyroid")
    );

    private static final Map<String, String> ORGAN_KEYS = Map.ofEntries(
            Map.entry("Bladder", "bladder"),
            Map.entry("Brain", "brain"),
            Map.entry("Breast", "breast"),
            Map.entry("Cervical", "cervical"),
            Map.entry("Colorectal", "colorectal"),
            Map.entry("Endometrial", "endometrial"),
            Map.entry("Esophageal", "esophageal"),
            Map.entry("Gastric", "gastric"),
            Map.entry("HeadAndNeck", "headAndNeck"),
            Map.entry("Kidney", "kidney"),
            Map.entry("Liver", "liver"),
            Map.entry("Lung", "lung"),
            Map.entry("Ovarian", "ovarian"),
            Map.entry("Pancreatic", "pancreatic"),
            Map.entry("Thyroid", "thyroid")
    );

    private final Path vafRootDir;
    private final ConcurrentMap<Path, DirectoryGeneIndex> geneIndexCache = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, CachedBodyMap> bodyMapCache = new ConcurrentHashMap<>();

    public VafAnalysisService(@Value("${app.vaf-gene-root-dir:/400T/cfdnadb}") String vafGeneRootDir) {
        this.vafRootDir = Path.of(vafGeneRootDir);
    }

    public VafBodyMapDto getBodyMap(String gene) {
        String normalizedGene = normalizeGene(gene);
        CachedBodyMap cached = bodyMapCache.get(normalizedGene);
        long now = System.currentTimeMillis();
        if (cached != null && now - cached.cachedAtMillis <= BODY_MAP_CACHE_TTL_MS) {
            return cached.value;
        }

        VafBodyMapDto computed = buildBodyMap(normalizedGene);
        bodyMapCache.put(normalizedGene, new CachedBodyMap(computed, now));
        return computed;
    }

    private VafBodyMapDto buildBodyMap(String normalizedGene) {
        if (!Files.isDirectory(vafRootDir)) {
            return new VafBodyMapDto(normalizedGene, List.of(), 0);
        }

        List<VafBodyMapEntryDto> entries = new ArrayList<>();
        Map<String, List<Double>> cancerTypeVafs = new HashMap<>();
        Map<String, List<Double>> mutationTypeVafs = new HashMap<>();
        try (Stream<Path> cohortDirs = Files.list(vafRootDir)) {
            List<Path> sortedDirs = cohortDirs
                    .filter(Files::isDirectory)
                    .sorted()
                    .collect(Collectors.toList());

            for (Path cohortDir : sortedDirs) {
                Path geneDir = cohortDir.resolve("Private_cfDNA").resolve("VAF_results").resolve("gene");
                if (!Files.isDirectory(geneDir)) {
                    continue;
                }
                Optional<Path> geneFile = findGeneFile(geneDir, normalizedGene);
                if (geneFile.isEmpty()) {
                    continue;
                }

                VafValues values = readVafValues(geneFile.get());
                if (values.vafs.isEmpty()) {
                    continue;
                }

                String cohort = cohortDir.getFileName().toString();
                String cancerType = normalizeCancerType(cohort);
                cancerTypeVafs.computeIfAbsent(cancerType, key -> new ArrayList<>()).addAll(values.vafs);
                for (VafObservation observation : values.observations) {
                    mutationTypeVafs
                            .computeIfAbsent(observation.mutationType, key -> new ArrayList<>())
                            .add(observation.vaf);
                }
                entries.add(new VafBodyMapEntryDto(
                        cohort,
                        cancerType,
                        ORGAN_KEYS.getOrDefault(cancerType, cancerType.toLowerCase(Locale.ROOT)),
                        mean(values.vafs),
                        median(values.vafs),
                        Collections.min(values.vafs),
                        Collections.max(values.vafs),
                        values.vafs.size(),
                        values.samples.size()
                ));
            }
        } catch (IOException e) {
            return new VafBodyMapDto(normalizedGene, List.of(), 0);
        }

        entries.sort((a, b) -> Double.compare(b.getMeanVaf(), a.getMeanVaf()));
        double maxMean = entries.stream().mapToDouble(VafBodyMapEntryDto::getMeanVaf).max().orElse(0);
        return new VafBodyMapDto(
                normalizedGene,
                entries,
                maxMean,
                buildBoxplot(normalizedGene + " VAF by cancer type", "Cancer type", cancerTypeVafs),
                buildBoxplot(normalizedGene + " VAF by mutation type", "Mutation type", mutationTypeVafs)
        );
    }

    private String normalizeGene(String gene) {
        String trimmed = gene == null ? "" : gene.trim();
        if (trimmed.isBlank()) {
            throw new IllegalArgumentException("Gene symbol is required");
        }
        if (!trimmed.matches("[A-Za-z0-9_.-]+")) {
            throw new IllegalArgumentException("Gene symbol contains unsupported characters");
        }
        return trimmed.toUpperCase(Locale.ROOT);
    }

    private Optional<Path> findGeneFile(Path geneDir, String gene) throws IOException {
        String geneKey = gene.toLowerCase(Locale.ROOT);
        Map<String, Path> fileIndex = getOrBuildGeneIndex(geneDir);
        for (String candidate : List.of(geneKey + ".txt", geneKey + "_exonic_vaf.txt")) {
            Path match = fileIndex.get(candidate);
            if (match != null && Files.isRegularFile(match)) {
                return Optional.of(match);
            }
        }
        return Optional.empty();
    }

    private Map<String, Path> getOrBuildGeneIndex(Path geneDir) throws IOException {
        long lastModifiedMillis = Files.getLastModifiedTime(geneDir).toMillis();
        DirectoryGeneIndex cached = geneIndexCache.get(geneDir);
        if (cached != null && cached.lastModifiedMillis == lastModifiedMillis) {
            return cached.filesByLowerName;
        }

        Map<String, Path> indexedFiles = new HashMap<>();
        try (Stream<Path> files = Files.list(geneDir)) {
            files.filter(Files::isRegularFile)
                    .forEach(path -> indexedFiles.put(path.getFileName().toString().toLowerCase(Locale.ROOT), path));
        }
        Map<String, Path> immutableIndex = Map.copyOf(indexedFiles);
        geneIndexCache.put(geneDir, new DirectoryGeneIndex(lastModifiedMillis, immutableIndex));
        return immutableIndex;
    }

    private VafValues readVafValues(Path file) {
        List<Double> values = new ArrayList<>();
        Set<String> samples = new HashSet<>();
        List<VafObservation> observations = new ArrayList<>();
        try (BufferedReader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            String header = reader.readLine();
            if (header == null) {
                return new VafValues(values, samples);
            }
            Map<String, Integer> headerIndex = headerIndex(header);
            Integer vafIndex = headerIndex.get("vaf");
            Integer sampleIndex = headerIndex.get("sample");
            Integer exonicFuncIndex = headerIndex.get("exonicfunc");
            if (vafIndex == null) {
                return new VafValues(values, samples);
            }

            String line;
            while ((line = reader.readLine()) != null) {
                String[] parts = line.split("\t", -1);
                if (parts.length <= vafIndex) {
                    continue;
                }
                try {
                    double vaf = Double.parseDouble(parts[vafIndex]);
                    values.add(vaf);
                    if (sampleIndex != null && parts.length > sampleIndex && !parts[sampleIndex].isBlank()) {
                        samples.add(parts[sampleIndex]);
                    }
                    String mutationType = exonicFuncIndex != null && parts.length > exonicFuncIndex
                            ? normalizeMutationType(parts[exonicFuncIndex])
                            : "Other";
                    observations.add(new VafObservation(vaf, mutationType));
                } catch (NumberFormatException ignored) {
                    // Skip malformed rows.
                }
            }
        } catch (IOException ignored) {
            return new VafValues(List.of(), Set.of());
        }
        return new VafValues(values, samples, observations);
    }

    private Map<String, Integer> headerIndex(String header) {
        Map<String, Integer> index = new HashMap<>();
        String[] fields = header.split("\t", -1);
        for (int i = 0; i < fields.length; i += 1) {
            index.put(fields[i].trim().toLowerCase(Locale.ROOT), i);
        }
        return index;
    }

    private String normalizeCancerType(String cancerType) {
        return CANCER_TYPE_ALIASES.getOrDefault(cancerType, cancerType);
    }

    private String normalizeMutationType(String exonicFunc) {
        String value = exonicFunc == null ? "" : exonicFunc.trim().toLowerCase(Locale.ROOT);
        if (value.isBlank() || value.equals(".") || value.equals("unknown")) {
            return "Other";
        }
        if (value.contains("nonframeshift") || value.contains("inframe")) {
            return "Inframe";
        }
        if (value.contains("frameshift")) {
            return "Frameshift";
        }
        if (value.contains("nonsynonymous") || value.contains("missense")) {
            return "Missense";
        }
        if (value.contains("stopgain") || value.contains("stoploss") || value.contains("nonsense")) {
            return "Nonsense";
        }
        if (value.contains("synonymous")) {
            return "Synonymous";
        }
        if (value.contains("splic")) {
            return "Splice_Site";
        }
        return "Other";
    }

    private VafBoxplotDto buildBoxplot(String title, String xLabel, Map<String, List<Double>> buckets) {
        Map<String, VafBoxStatsDto> groups = buckets.entrySet().stream()
                .filter(entry -> !entry.getValue().isEmpty())
                .sorted((a, b) -> {
                    int byMedian = Double.compare(median(b.getValue()), median(a.getValue()));
                    return byMedian != 0 ? byMedian : a.getKey().compareTo(b.getKey());
                })
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        entry -> boxplotStats(entry.getValue()),
                        (left, right) -> left,
                        LinkedHashMap::new
                ));
        return new VafBoxplotDto(title, xLabel, "Variant Allele Frequency (VAF)", groups);
    }

    private VafBoxStatsDto boxplotStats(List<Double> values) {
        List<Double> sorted = new ArrayList<>(values);
        Collections.sort(sorted);
        double[] arr = sorted.stream().mapToDouble(Double::doubleValue).toArray();
        double min = arr[0];
        double max = arr[arr.length - 1];
        double q1 = quantile(arr, 0.25);
        double med = quantile(arr, 0.5);
        double q3 = quantile(arr, 0.75);
        double iqr = q3 - q1;
        double lowFence = q1 - 1.5 * iqr;
        double highFence = q3 + 1.5 * iqr;
        double whiskerLow = min;
        for (double value : arr) {
            if (value >= lowFence) {
                whiskerLow = value;
                break;
            }
        }
        double whiskerHigh = max;
        for (int i = arr.length - 1; i >= 0; i -= 1) {
            if (arr[i] <= highFence) {
                whiskerHigh = arr[i];
                break;
            }
        }
        return new VafBoxStatsDto(
                sorted.size(),
                min,
                q1,
                med,
                q3,
                max,
                whiskerLow,
                whiskerHigh,
                sorted
        );
    }

    private double quantile(double[] sorted, double q) {
        if (sorted.length == 0) return Double.NaN;
        if (sorted.length == 1) return sorted[0];
        double position = q * (sorted.length - 1);
        int low = (int) Math.floor(position);
        int high = (int) Math.ceil(position);
        if (low == high) return sorted[low];
        return sorted[low] + (position - low) * (sorted[high] - sorted[low]);
    }

    private double mean(List<Double> values) {
        if (values.isEmpty()) return 0;
        return values.stream().mapToDouble(Double::doubleValue).average().orElse(0);
    }

    private double median(List<Double> values) {
        if (values.isEmpty()) return 0;
        List<Double> sorted = new ArrayList<>(values);
        Collections.sort(sorted);
        int mid = sorted.size() / 2;
        return sorted.size() % 2 == 0
                ? (sorted.get(mid - 1) + sorted.get(mid)) / 2.0
                : sorted.get(mid);
    }

    private static class VafValues {
        private final List<Double> vafs;
        private final Set<String> samples;
        private final List<VafObservation> observations;

        private VafValues(List<Double> vafs, Set<String> samples) {
            this(vafs, samples, List.of());
        }

        private VafValues(List<Double> vafs, Set<String> samples, List<VafObservation> observations) {
            this.vafs = vafs;
            this.samples = samples;
            this.observations = observations;
        }
    }

    private static class VafObservation {
        private final double vaf;
        private final String mutationType;

        private VafObservation(double vaf, String mutationType) {
            this.vaf = vaf;
            this.mutationType = mutationType;
        }
    }

    private static class DirectoryGeneIndex {
        private final long lastModifiedMillis;
        private final Map<String, Path> filesByLowerName;

        private DirectoryGeneIndex(long lastModifiedMillis, Map<String, Path> filesByLowerName) {
            this.lastModifiedMillis = lastModifiedMillis;
            this.filesByLowerName = filesByLowerName;
        }
    }

    private static class CachedBodyMap {
        private final VafBodyMapDto value;
        private final long cachedAtMillis;

        private CachedBodyMap(VafBodyMapDto value, long cachedAtMillis) {
            this.value = value;
            this.cachedAtMillis = cachedAtMillis;
        }
    }
}
