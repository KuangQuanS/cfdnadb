package org.cfdna.database.controller;

import org.cfdna.database.dto.ApiResponse;
import org.cfdna.database.dto.FilterOptionsDto;
import org.cfdna.database.dto.VisualizationSummaryDto;
import org.cfdna.database.service.MetadataService;
import org.cfdna.database.service.VisualizationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class MetadataController {

    private final MetadataService metadataService;
    private final VisualizationService visualizationService;

    public MetadataController(MetadataService metadataService, VisualizationService visualizationService) {
        this.metadataService = metadataService;
        this.visualizationService = visualizationService;
    }

    @GetMapping("/filters")
    public ApiResponse<FilterOptionsDto> getFilterOptions() {
        return ApiResponse.success(metadataService.getFilterOptions());
    }

    @GetMapping("/visualizations/summary")
    public ApiResponse<VisualizationSummaryDto> getVisualizationSummary() {
        return ApiResponse.success(visualizationService.getSummary());
    }
}
