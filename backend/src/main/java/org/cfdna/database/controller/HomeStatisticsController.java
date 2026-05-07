package org.cfdna.database.controller;

import org.cfdna.database.dto.ApiResponse;
import org.cfdna.database.dto.HomeBodyCalloutDto;
import org.cfdna.database.service.CsvStatisticsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/home")
public class HomeStatisticsController {

    private final CsvStatisticsService csvStatisticsService;

    public HomeStatisticsController(CsvStatisticsService csvStatisticsService) {
        this.csvStatisticsService = csvStatisticsService;
    }

    @GetMapping("/body-callouts")
    public ApiResponse<List<HomeBodyCalloutDto>> getBodyCallouts() {
        return ApiResponse.success(csvStatisticsService.readHomeBodyCallouts().orElse(List.of()));
    }
}
