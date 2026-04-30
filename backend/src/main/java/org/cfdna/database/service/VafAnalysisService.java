package org.cfdna.database.service;

import org.cfdna.database.dto.VafBodyMapDto;
import org.cfdna.database.dto.VafBodyMapEntryDto;
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
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class VafAnalysisService {

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

    public VafAnalysisService(@Value("${app.vaf-gene-root-dir:/400T/cfdnadb}") String vafGeneRootDir) {
        this.vafRootDir = Path.of(vafGeneRootDir);
    }

    public VafBodyMapDto getBodyMap(String gene) {
        String normalizedGene = normalizeGene(gene);
        if (!Files.isDirectory(vafRootDir)) {
            return new VafBodyMapDto(normalizedGene, List.of(), 0);
        }

        List<VafBodyMapEntryDto> entries = new ArrayList<>();
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
        return new VafBodyMapDto(normalizedGene, entries, maxMean);
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
        String exact = gene.toLowerCase(Locale.ROOT) + ".txt";
        String exonic = gene.toLowerCase(Locale.ROOT) + "_exonic_vaf.txt";
        try (Stream<Path> files = Files.list(geneDir)) {
            return files
                    .filter(Files::isRegularFile)
                    .filter(path -> {
                        String fileName = path.getFileName().toString().toLowerCase(Locale.ROOT);
                        return fileName.equals(exact) || fileName.equals(exonic);
                    })
                    .findFirst();
        }
    }

    private VafValues readVafValues(Path file) {
        List<Double> values = new ArrayList<>();
        Set<String> samples = new HashSet<>();
        try (BufferedReader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            String header = reader.readLine();
            if (header == null) {
                return new VafValues(values, samples);
            }
            Map<String, Integer> headerIndex = headerIndex(header);
            Integer vafIndex = headerIndex.get("vaf");
            Integer sampleIndex = headerIndex.get("sample");
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
                    values.add(Double.parseDouble(parts[vafIndex]));
                    if (sampleIndex != null && parts.length > sampleIndex && !parts[sampleIndex].isBlank()) {
                        samples.add(parts[sampleIndex]);
                    }
                } catch (NumberFormatException ignored) {
                    // Skip malformed rows.
                }
            }
        } catch (IOException ignored) {
            return new VafValues(List.of(), Set.of());
        }
        return new VafValues(values, samples);
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

        private VafValues(List<Double> vafs, Set<String> samples) {
            this.vafs = vafs;
            this.samples = samples;
        }
    }
}
