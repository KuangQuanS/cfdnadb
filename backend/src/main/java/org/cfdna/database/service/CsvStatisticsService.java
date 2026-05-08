package org.cfdna.database.service;

import org.cfdna.database.dto.CancerSummaryDto;
import org.cfdna.database.dto.HomeBodyCalloutDto;
import org.cfdna.database.dto.LabelCountDto;
import org.cfdna.database.dto.MafSummaryDto;
import org.cfdna.database.dto.StatisticsOverviewDto;
import org.cfdna.database.dto.TopGeneDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
public class CsvStatisticsService {

    private final Path csvDir;
    private volatile Optional<List<LabelCountDto>> cachedHomeSourceSamples;
    private volatile Optional<List<CancerSummaryDto>> cachedHomeSampleCategories;
    private volatile Optional<List<HomeBodyCalloutDto>> cachedHomeBodyCallouts;

    public CsvStatisticsService(@Value("${app.data-dir:/400T/cfdnaweb}") String dataDir) {
        this.csvDir = Path.of(dataDir).resolve("statistics").resolve("csv");
    }

    public Optional<List<LabelCountDto>> readHomeSourceSamples() {
        Optional<List<LabelCountDto>> snapshot = cachedHomeSourceSamples;
        if (snapshot == null) {
            synchronized (this) {
                snapshot = cachedHomeSourceSamples;
                if (snapshot == null) {
                    snapshot = readUnifiedLabelCounts("home", "sourceSamples").map(List::copyOf);
                    cachedHomeSourceSamples = snapshot;
                }
            }
        }
        return snapshot;
    }

    public Optional<List<CancerSummaryDto>> readHomeSampleCategories() {
        Optional<List<CancerSummaryDto>> snapshot = cachedHomeSampleCategories;
        if (snapshot == null) {
            synchronized (this) {
                snapshot = cachedHomeSampleCategories;
                if (snapshot == null) {
                    snapshot = readUnifiedCancerSummaries("home", "sampleCategories").map(List::copyOf);
                    cachedHomeSampleCategories = snapshot;
                }
            }
        }
        return snapshot;
    }

    public Optional<List<HomeBodyCalloutDto>> readHomeBodyCallouts() {
        Optional<List<HomeBodyCalloutDto>> snapshot = cachedHomeBodyCallouts;
        if (snapshot == null) {
            synchronized (this) {
                snapshot = cachedHomeBodyCallouts;
                if (snapshot == null) {
                    snapshot = loadHomeBodyCallouts().map(List::copyOf);
                    cachedHomeBodyCallouts = snapshot;
                }
            }
        }
        return snapshot;
    }

    private Optional<List<HomeBodyCalloutDto>> loadHomeBodyCallouts() {
        Path path = csvDir.resolve("home_body_callouts.csv");
        if (!Files.isRegularFile(path)) return Optional.empty();
        List<HomeBodyCalloutDto> rows = new ArrayList<>();
        for (Map<String, String> row : readCsv(path)) {
            String id = first(row, "id", "cancer");
            rows.add(new HomeBodyCalloutDto(
                    id,
                    first(row, "label", id),
                    first(row, "side", "left"),
                    parseDouble(first(row, "labelTopPct", "0"), 0),
                    parseDouble(first(row, "labelXPct", "0"), 0),
                    parseDouble(first(row, "pointXPct", "0"), 0),
                    parseDouble(first(row, "pointYPct", "0"), 0),
                    first(row, "browseKey", id),
                    parseBoolean(first(row, "showConnector", "true")),
                    parseLong(first(row, "count", "0"), 0)
            ));
        }
        return Optional.of(rows);
    }

    public Optional<StatisticsOverviewDto> readStatisticsOverview(String key, String sourceLabel) {
        Path path = csvDir.resolve("statistics.csv");
        if (!Files.isRegularFile(path)) return Optional.empty();
        return readStatisticsOverview(path, key, sourceLabel);
    }

    private Optional<StatisticsOverviewDto> readStatisticsOverview(Path path, String scope, String sourceLabel) {
        long totalVariants = 0;
        long totalSamples = 0;
        long totalGenes = 0;
        List<CancerSummaryDto> cancers = new ArrayList<>();
        List<LabelCountDto> func = new ArrayList<>();
        List<LabelCountDto> exonic = new ArrayList<>();
        List<LabelCountDto> chrom = new ArrayList<>();
        List<TopGeneDto> topGenes = new ArrayList<>();

        for (Map<String, String> row : readCsv(path)) {
            if (!scope.isBlank() && !scope.equals(first(row, "scope", ""))) continue;
            String section = first(row, "section", "").trim();
            String label = first(row, "label", "");
            long count = parseLong(first(row, "count", "0"), 0);
            switch (section) {
                case "mafSummary":
                    if ("totalVariants".equals(label)) totalVariants = count;
                    if ("totalSamples".equals(label)) totalSamples = count;
                    if ("totalGenes".equals(label)) totalGenes = count;
                    break;
                case "cancerSummary":
                    cancers.add(summary(row, label, count));
                    break;
                case "funcDistribution":
                    func.add(new LabelCountDto(label, count));
                    break;
                case "exonicDistribution":
                    exonic.add(new LabelCountDto(label, count));
                    break;
                case "chromDistribution":
                    chrom.add(new LabelCountDto(label, count));
                    break;
                case "topGenes":
                    topGenes.add(new TopGeneDto(label, count));
                    break;
                default:
                    break;
            }
        }
        if (totalVariants == 0 && totalSamples == 0 && totalGenes == 0
                && cancers.isEmpty() && func.isEmpty() && exonic.isEmpty()
                && chrom.isEmpty() && topGenes.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new StatisticsOverviewDto(
                sourceLabel,
                Instant.now().toString(),
                cancers,
                new MafSummaryDto(sourceLabel, totalVariants, totalSamples, totalGenes),
                func,
                exonic,
                chrom,
                topGenes
        ));
    }

    private Optional<List<LabelCountDto>> readUnifiedLabelCounts(String scope, String section) {
        Path path = csvDir.resolve("statistics.csv");
        if (!Files.isRegularFile(path)) return Optional.empty();
        List<LabelCountDto> rows = new ArrayList<>();
        for (Map<String, String> row : readCsv(path)) {
            if (scope.equals(first(row, "scope", "")) && section.equals(first(row, "section", ""))) {
                rows.add(new LabelCountDto(first(row, "label", ""), parseLong(first(row, "count", "0"), 0)));
            }
        }
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows);
    }

    private Optional<List<CancerSummaryDto>> readUnifiedCancerSummaries(String scope, String section) {
        Path path = csvDir.resolve("statistics.csv");
        if (!Files.isRegularFile(path)) return Optional.empty();
        List<CancerSummaryDto> rows = new ArrayList<>();
        for (Map<String, String> row : readCsv(path)) {
            if (scope.equals(first(row, "scope", "")) && section.equals(first(row, "section", ""))) {
                String label = first(row, "label", "");
                rows.add(summary(row, label, parseLong(first(row, "count", "0"), 0)));
            }
        }
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows);
    }

    private static CancerSummaryDto summary(String cancer, long sampleCount) {
        return summary(Map.of(), cancer, sampleCount);
    }

    private static CancerSummaryDto summary(Map<String, String> row, String cancer, long sampleCount) {
        return new CancerSummaryDto(
                cancer,
                sampleCount,
                parseLong(first(row, "totalDataFiles", String.valueOf(sampleCount)), sampleCount),
                parseLong(first(row, "avinputCount", String.valueOf(sampleCount)), sampleCount),
                parseLong(first(row, "filteredCount", "0"), 0),
                parseLong(first(row, "annotatedCount", String.valueOf(sampleCount)), sampleCount),
                parseLong(first(row, "somaticCount", "0"), 0),
                parseLong(first(row, "plotAssetCount", "0"), 0),
                parseLong(first(row, "externalAssetCount", "0"), 0),
                parseLong(first(row, "mutationCount", "0"), 0),
                first(row, "rawImportStatus", status(sampleCount)),
                first(row, "filteredStatus", status(sampleCount)),
                first(row, "annotatedStatus", status(sampleCount)),
                first(row, "somaticStatus", "Not started"),
                first(row, "plotStatus", "Not started"),
                first(row, "externalStatus", "Not started"));
    }

    private static String status(long count) {
        return count > 0 ? "Completed" : "Not started";
    }

    private static List<Map<String, String>> readCsv(Path path) {
        try {
            List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
            if (lines.isEmpty()) return List.of();
            List<String> headers = parseLine(lines.get(0));
            List<Map<String, String>> rows = new ArrayList<>();
            for (int i = 1; i < lines.size(); i++) {
                String line = lines.get(i);
                if (line.trim().isEmpty() || line.trim().startsWith("#")) continue;
                List<String> values = parseLine(line);
                Map<String, String> row = new HashMap<>();
                for (int j = 0; j < headers.size(); j++) {
                    row.put(headers.get(j), j < values.size() ? values.get(j) : "");
                }
                rows.add(row);
            }
            return rows;
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to read statistics CSV: " + path, exception);
        }
    }

    private static List<String> parseLine(String line) {
        List<String> values = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (ch == '"') {
                if (quoted && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    current.append('"');
                    i++;
                } else {
                    quoted = !quoted;
                }
            } else if (ch == ',' && !quoted) {
                values.add(current.toString().trim());
                current.setLength(0);
            } else {
                current.append(ch);
            }
        }
        values.add(current.toString().trim());
        return values;
    }

    private static String first(Map<String, String> row, String key, String fallback) {
        String value = row.get(key);
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static long parseLong(String value, long fallback) {
        try {
            return Long.parseLong(value.replace(",", "").trim());
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private static double parseDouble(String value, double fallback) {
        try {
            return Double.parseDouble(value.trim());
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private static boolean parseBoolean(String value) {
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return !("false".equals(normalized) || "0".equals(normalized) || "no".equals(normalized));
    }
}
