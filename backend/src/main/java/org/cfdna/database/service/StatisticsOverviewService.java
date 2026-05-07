package org.cfdna.database.service;

import org.cfdna.database.dto.MafSummaryDto;
import org.cfdna.database.dto.StatisticsOverviewDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.time.Instant;
import java.util.List;

@Service
public class StatisticsOverviewService {

    private final CsvStatisticsService csvStatisticsService;
    private final long refreshMs;

    private volatile StatisticsOverviewDto cachedOverview;
    private volatile long cachedAtMillis;

    public StatisticsOverviewService(CsvStatisticsService csvStatisticsService,
                                     @Value("${app.statistics-overview-refresh-ms:1800000}") long refreshMs) {
        this.csvStatisticsService = csvStatisticsService;
        this.refreshMs = Math.max(refreshMs, 60_000L);
    }

    @PostConstruct
    public void warmCacheOnStartup() {
        refreshCacheSafely("startup");
    }

    @Scheduled(fixedDelayString = "${app.statistics-overview-refresh-ms:1800000}")
    public void scheduledRefresh() {
        refreshCacheSafely("scheduled");
    }

    public StatisticsOverviewDto getCfDnaOverview() {
        return csvStatisticsService.readStatisticsOverview("internal", "cfDNA").orElseGet(() -> emptyOverview("cfDNA"));
    }

    private StatisticsOverviewDto getCachedCfDnaOverview() {
        StatisticsOverviewDto snapshot = cachedOverview;
        long age = System.currentTimeMillis() - cachedAtMillis;
        if (snapshot == null || age > refreshMs) {
            synchronized (this) {
                snapshot = cachedOverview;
                age = System.currentTimeMillis() - cachedAtMillis;
                if (snapshot == null || age > refreshMs) {
                    refreshCacheSafely("lazy");
                    snapshot = cachedOverview;
                }
            }
        }
        return snapshot != null ? snapshot : emptyOverview("cfDNA");
    }

    private void refreshCacheSafely(String trigger) {
        cachedOverview = csvStatisticsService.readStatisticsOverview("internal", "cfDNA").orElseGet(() -> emptyOverview("cfDNA"));
        cachedAtMillis = System.currentTimeMillis();
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
        return csvStatisticsService.readStatisticsOverview("public", "Public").orElseGet(() -> emptyOverview("Public"));
    }

    public List<String> listPublicCohortNames() {
        return List.of("Public Cohort");
    }
}
