package org.cfdna.database.controller;

import org.cfdna.database.dto.ApiResponse;
import org.cfdna.database.dto.StatisticsOverviewDto;
import org.cfdna.database.dto.VafDistributionDto;
import org.cfdna.database.service.DuckDbService;
import org.cfdna.database.service.StatisticsOverviewService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/statistics")
public class StatisticsOverviewController {

    private final StatisticsOverviewService statisticsOverviewService;
    private final DuckDbService duckDbService;

    public StatisticsOverviewController(StatisticsOverviewService statisticsOverviewService,
                                        DuckDbService duckDbService) {
        this.statisticsOverviewService = statisticsOverviewService;
        this.duckDbService = duckDbService;
    }

    @GetMapping("/overview")
    public ApiResponse<StatisticsOverviewDto> getOverview() {
        return ApiResponse.success(statisticsOverviewService.getCfDnaOverview());
    }

    @GetMapping("/vaf-distribution")
    public ApiResponse<List<VafDistributionDto>> getVafDistribution() {
        return ApiResponse.success(duckDbService.getVafDistribution());
    }
}
