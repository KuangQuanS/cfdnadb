package org.cfdna.database.controller;

import org.cfdna.database.dto.ApiResponse;
import org.cfdna.database.dto.DatabaseStatsDto;
import org.cfdna.database.service.DuckDbService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/stats")
public class DatabaseStatsController {

    private final DuckDbService duckDbService;

    public DatabaseStatsController(DuckDbService duckDbService) {
        this.duckDbService = duckDbService;
    }

    @GetMapping
    public ApiResponse<DatabaseStatsDto> getDatabaseStats() {
        return ApiResponse.success(duckDbService.getDatabaseStats());
    }
}
