package org.cfdna.database.controller;

import org.cfdna.database.dto.ApiResponse;
import org.cfdna.database.dto.CancerSummaryDto;
import org.cfdna.database.service.DuckDbService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/summary")
public class CancerSummaryController {

    private final DuckDbService duckDbService;

    public CancerSummaryController(DuckDbService duckDbService) {
        this.duckDbService = duckDbService;
    }

    @GetMapping("/cancers")
    public ApiResponse<List<CancerSummaryDto>> getCancerSummary() {
        return ApiResponse.success(duckDbService.getCancerSummary());
    }
}
