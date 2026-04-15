package org.cfdna.database.controller;

import org.cfdna.database.dto.ApiResponse;
import org.cfdna.database.dto.StatisticsOverviewDto;
import org.cfdna.database.service.StatisticsOverviewService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/statistics")
public class StatisticsOverviewController {

    private final StatisticsOverviewService statisticsOverviewService;

    public StatisticsOverviewController(StatisticsOverviewService statisticsOverviewService) {
        this.statisticsOverviewService = statisticsOverviewService;
    }

    @GetMapping("/overview")
    public ApiResponse<StatisticsOverviewDto> getOverview() {
        return ApiResponse.success(statisticsOverviewService.getCfDnaOverview());
    }
}
