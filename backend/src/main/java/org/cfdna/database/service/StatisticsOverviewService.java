package org.cfdna.database.service;

import org.cfdna.database.dto.MafSummaryDto;
import org.cfdna.database.dto.StatisticsOverviewDto;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class StatisticsOverviewService {

    private final CsvStatisticsService csvStatisticsService;

    private volatile StatisticsOverviewDto cachedOverview;
    private final ConcurrentMap<String, StatisticsOverviewDto> publicOverviewCache = new ConcurrentHashMap<>();

    public StatisticsOverviewService(CsvStatisticsService csvStatisticsService) {
        this.csvStatisticsService = csvStatisticsService;
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
        String cacheKey = cancer == null || cancer.isBlank() ? "__all__" : cancer.trim().toLowerCase(Locale.ROOT);
        return publicOverviewCache.computeIfAbsent(
                cacheKey,
                ignored -> csvStatisticsService.readStatisticsOverview("public", "Public").orElseGet(() -> emptyOverview("Public"))
        );
    }

    public List<String> listPublicCohortNames() {
        return List.of("Public Cohort");
    }
}
