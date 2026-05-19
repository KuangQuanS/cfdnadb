package org.cfdna.database.service;

import org.cfdna.database.dto.CancerSummaryDto;
import org.cfdna.database.dto.LabelCountDto;
import org.cfdna.database.dto.MafSummaryDto;
import org.cfdna.database.dto.StatisticsOverviewDto;
import org.cfdna.database.dto.TopGeneDto;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.stream.Collectors;

@Service
public class StatisticsOverviewService {

    private final CsvStatisticsService csvStatisticsService;
    private final DuckDbService duckDbService;

    private volatile StatisticsOverviewDto cachedOverview;
    private final ConcurrentMap<String, StatisticsOverviewDto> publicOverviewCache = new ConcurrentHashMap<>();

    public StatisticsOverviewService(CsvStatisticsService csvStatisticsService,
                                     DuckDbService duckDbService) {
        this.csvStatisticsService = csvStatisticsService;
        this.duckDbService = duckDbService;
    }

    @PostConstruct
    public void warmCacheOnStartup() {
        cachedOverview = loadCfDnaOverview();
    }

    public StatisticsOverviewDto getCfDnaOverview() {
        StatisticsOverviewDto snapshot = cachedOverview;
        if (snapshot == null) {
            synchronized (this) {
                snapshot = cachedOverview;
                if (snapshot == null) {
                    cachedOverview = loadCfDnaOverview();
                    snapshot = cachedOverview;
                }
            }
        }
        return snapshot != null ? snapshot : emptyOverview("cfDNA");
    }

    private StatisticsOverviewDto loadCfDnaOverview() {
        return csvStatisticsService.readStatisticsOverview("internal", "cfDNA").orElseGet(() -> emptyOverview("cfDNA"));
    }

    private StatisticsOverviewDto emptyOverview(String source) {
        return new StatisticsOverviewDto(
                source,
                Instant.now().toString(),
                List.of(),
                new MafSummaryDto(source, 0, 0, 0),
                List.of(),
                List.of(),
                List.of(),
                List.of()
        );
    }

    public StatisticsOverviewDto getPublicOverview(String cancer) {
        String cacheKey = "public-with-tcga";
        return publicOverviewCache.computeIfAbsent(
                cacheKey,
                ignored -> mergePublicWithTcgaOverview()
        );
    }

    public List<String> listPublicCohortNames() {
        return List.of("Public Cohort");
    }

    private StatisticsOverviewDto mergePublicWithTcgaOverview() {
        StatisticsOverviewDto publicOverview = csvStatisticsService
                .readStatisticsOverview("public", "Public")
                .orElseGet(() -> emptyOverview("Public"));
        StatisticsOverviewDto tcgaOverview = duckDbService.getTcgaStatisticsOverview();

        return new StatisticsOverviewDto(
                "Public",
                Instant.now().toString(),
                mergeCancerSummary(publicOverview.getCancerSummary(), tcgaOverview.getCancerSummary()),
                mergeMafSummary(publicOverview.getMafSummary(), tcgaOverview.getMafSummary()),
                mergeLabelCounts(publicOverview.getFuncDistribution(), tcgaOverview.getFuncDistribution()),
                mergeLabelCounts(publicOverview.getExonicDistribution(), tcgaOverview.getExonicDistribution()),
                mergeLabelCounts(publicOverview.getChromDistribution(), tcgaOverview.getChromDistribution()),
                mergeTopGenes(publicOverview.getTopGenes(), tcgaOverview.getTopGenes())
        );
    }

    private MafSummaryDto mergeMafSummary(MafSummaryDto first, MafSummaryDto second) {
        return new MafSummaryDto(
                "Public",
                value(first, MafSummaryDto::getTotalVariants) + value(second, MafSummaryDto::getTotalVariants),
                value(first, MafSummaryDto::getTotalSamples) + value(second, MafSummaryDto::getTotalSamples),
                value(first, MafSummaryDto::getTotalGenes) + value(second, MafSummaryDto::getTotalGenes)
        );
    }

    private long value(MafSummaryDto dto, java.util.function.ToLongFunction<MafSummaryDto> getter) {
        return dto == null ? 0 : getter.applyAsLong(dto);
    }

    private List<CancerSummaryDto> mergeCancerSummary(List<CancerSummaryDto> first, List<CancerSummaryDto> second) {
        Map<String, CancerAccumulator> merged = new LinkedHashMap<>();
        mergeCancerRows(merged, first);
        mergeCancerRows(merged, second);
        return merged.values().stream()
                .map(CancerAccumulator::toDto)
                .sorted(Comparator.comparingLong(CancerSummaryDto::getSampleCount).reversed()
                        .thenComparing(CancerSummaryDto::getCancer))
                .collect(Collectors.toList());
    }

    private void mergeCancerRows(Map<String, CancerAccumulator> merged, List<CancerSummaryDto> rows) {
        if (rows == null) return;
        for (CancerSummaryDto row : rows) {
            if (row == null || row.getCancer() == null || row.getCancer().isBlank()) continue;
            merged.computeIfAbsent(row.getCancer(), CancerAccumulator::new).add(row);
        }
    }

    private List<LabelCountDto> mergeLabelCounts(List<LabelCountDto> first, List<LabelCountDto> second) {
        Map<String, Long> counts = new LinkedHashMap<>();
        addLabelCounts(counts, first);
        addLabelCounts(counts, second);
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed()
                        .thenComparing(Map.Entry.comparingByKey()))
                .map(entry -> new LabelCountDto(entry.getKey(), entry.getValue()))
                .collect(Collectors.toList());
    }

    private void addLabelCounts(Map<String, Long> counts, List<LabelCountDto> rows) {
        if (rows == null) return;
        for (LabelCountDto row : rows) {
            if (row == null || row.getLabel() == null || row.getLabel().isBlank()) continue;
            counts.merge(row.getLabel(), row.getCount(), Long::sum);
        }
    }

    private List<TopGeneDto> mergeTopGenes(List<TopGeneDto> first, List<TopGeneDto> second) {
        Map<String, Long> counts = new LinkedHashMap<>();
        addTopGeneCounts(counts, first);
        addTopGeneCounts(counts, second);
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed()
                        .thenComparing(Map.Entry.comparingByKey()))
                .limit(20)
                .map(entry -> new TopGeneDto(entry.getKey(), entry.getValue()))
                .collect(Collectors.toList());
    }

    private void addTopGeneCounts(Map<String, Long> counts, List<TopGeneDto> rows) {
        if (rows == null) return;
        for (TopGeneDto row : rows) {
            if (row == null || row.getGene() == null || row.getGene().isBlank()) continue;
            counts.merge(row.getGene(), row.getCount(), Long::sum);
        }
    }

    private static class CancerAccumulator {
        private final String cancer;
        private long sampleCount;
        private long totalDataFiles;
        private long avinputCount;
        private long filteredCount;
        private long annotatedCount;
        private long somaticCount;
        private long plotAssetCount;
        private long externalAssetCount;
        private long mutationCount;
        private final List<String> rawImportStatuses = new ArrayList<>();
        private final List<String> filteredStatuses = new ArrayList<>();
        private final List<String> annotatedStatuses = new ArrayList<>();
        private final List<String> somaticStatuses = new ArrayList<>();
        private final List<String> plotStatuses = new ArrayList<>();
        private final List<String> externalStatuses = new ArrayList<>();

        private CancerAccumulator(String cancer) {
            this.cancer = cancer;
        }

        private void add(CancerSummaryDto row) {
            sampleCount += row.getSampleCount();
            totalDataFiles += row.getTotalDataFiles();
            avinputCount += row.getAvinputCount();
            filteredCount += row.getFilteredCount();
            annotatedCount += row.getAnnotatedCount();
            somaticCount += row.getSomaticCount();
            plotAssetCount += row.getPlotAssetCount();
            externalAssetCount += row.getExternalAssetCount();
            mutationCount += row.getMutationCount();
            rawImportStatuses.add(row.getRawImportStatus());
            filteredStatuses.add(row.getFilteredStatus());
            annotatedStatuses.add(row.getAnnotatedStatus());
            somaticStatuses.add(row.getSomaticStatus());
            plotStatuses.add(row.getPlotStatus());
            externalStatuses.add(row.getExternalStatus());
        }

        private CancerSummaryDto toDto() {
            return new CancerSummaryDto(
                    cancer,
                    sampleCount,
                    totalDataFiles,
                    avinputCount,
                    filteredCount,
                    annotatedCount,
                    somaticCount,
                    plotAssetCount,
                    externalAssetCount,
                    mutationCount,
                    mergeStatus(rawImportStatuses),
                    mergeStatus(filteredStatuses),
                    mergeStatus(annotatedStatuses),
                    mergeStatus(somaticStatuses),
                    mergeStatus(plotStatuses),
                    mergeStatus(externalStatuses)
            );
        }

        private String mergeStatus(List<String> statuses) {
            if (statuses.stream().anyMatch("Complete"::equalsIgnoreCase)) return "Complete";
            if (statuses.stream().anyMatch("Partial"::equalsIgnoreCase)) return "Partial";
            if (statuses.stream().anyMatch("Not started"::equalsIgnoreCase)) return "Not started";
            return "Not started";
        }
    }
}
