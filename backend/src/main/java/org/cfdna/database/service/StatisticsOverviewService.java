package org.cfdna.database.service;

import org.cfdna.database.dto.CancerSummaryDto;
import org.cfdna.database.dto.LabelCountDto;
import org.cfdna.database.dto.MafSummaryDto;
import org.cfdna.database.dto.StatisticsOverviewDto;
import org.cfdna.database.dto.TopGeneDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.time.Instant;
import java.util.List;

@Service
public class StatisticsOverviewService {

    private static final Logger log = LoggerFactory.getLogger(StatisticsOverviewService.class);
    private static final String ALL_COHORTS = String.join(",",
            List.of("Breast", "Colorectal", "Liver", "Lung", "Pancreatic",
                    "Bladder", "Cervical", "Endometrial", "Esophageal", "Gastric",
                    "HeadAndNeck", "Kidney", "Ovarian", "Thyroid", "Benign_Tumor", "Cell_Line"));

    private final DuckDbService duckDbService;
    private final long refreshMs;

    private volatile StatisticsOverviewDto cachedOverview;
    private volatile long cachedAtMillis;

    public StatisticsOverviewService(DuckDbService duckDbService,
                                     @Value("${app.statistics-overview-refresh-ms:1800000}") long refreshMs) {
        this.duckDbService = duckDbService;
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
        return snapshot != null ? snapshot : emptyOverview();
    }

    private void refreshCacheSafely(String trigger) {
        try {
            long start = System.currentTimeMillis();
            StatisticsOverviewDto computed = computeOverview();
            cachedOverview = computed;
            cachedAtMillis = System.currentTimeMillis();
            log.info("[StatisticsOverview] Refreshed cache via {} in {} ms", trigger, cachedAtMillis - start);
        } catch (Exception exception) {
            log.warn("[StatisticsOverview] Failed to refresh cache via {}: {}", trigger, exception.getMessage(), exception);
        }
    }

    private StatisticsOverviewDto computeOverview() {
        List<CancerSummaryDto> cancerSummary = duckDbService.getCancerSummary();
        MafSummaryDto mafSummary = duckDbService.getMafSummary("cfDNA", null, null, null, null, null, null);
        List<LabelCountDto> funcDistribution = duckDbService.getFuncDistribution(ALL_COHORTS);
        List<LabelCountDto> exonicDistribution = duckDbService.getExonicDistribution(ALL_COHORTS);
        List<LabelCountDto> chromDistribution = duckDbService.getChromDistribution(ALL_COHORTS);
        List<TopGeneDto> topGenes = duckDbService.getMafTopGenes("cfDNA", 15);

        return new StatisticsOverviewDto(
                "cfDNA",
                Instant.now().toString(),
                cancerSummary,
                mafSummary,
                funcDistribution,
                exonicDistribution,
                chromDistribution,
                topGenes
        );
    }

    private StatisticsOverviewDto emptyOverview() {
        return new StatisticsOverviewDto(
                "cfDNA",
                Instant.now().toString(),
                List.of(),
                new MafSummaryDto("cfDNA", 0, 0, 0),
                List.of(),
                List.of(),
                List.of(),
                List.of()
        );
    }

    public StatisticsOverviewDto getPublicOverview(String cancer) {
        String cohort = (cancer == null || cancer.isBlank()) ? null : cancer.trim();
        String targetCohorts = cohort == null ? String.join(",", duckDbService.listPublicCohortNames()) : cohort;
        if (targetCohorts == null || targetCohorts.isBlank()) {
            return new StatisticsOverviewDto(
                    "Public",
                    Instant.now().toString(),
                    List.of(),
                    new MafSummaryDto("Public", 0, 0, 0),
                    List.of(), List.of(), List.of(), List.of()
            );
        }
        return new StatisticsOverviewDto(
                "Public",
                Instant.now().toString(),
                List.of(),
                duckDbService.getPublicMafSummary(targetCohorts),
                duckDbService.getPublicFuncDistribution(targetCohorts),
                duckDbService.getPublicExonicDistribution(targetCohorts),
                duckDbService.getPublicChromDistribution(targetCohorts),
                List.of()
        );
    }

    public List<String> listPublicCohortNames() {
        return duckDbService.listPublicCohortNames();
    }
}
