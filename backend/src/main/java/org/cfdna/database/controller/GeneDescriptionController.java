package org.cfdna.database.controller;

import org.cfdna.database.dto.ApiResponse;
import org.cfdna.database.dto.GeneDescriptionDto;
import org.cfdna.database.service.GeneDescriptionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/genes")
public class GeneDescriptionController {

    private final GeneDescriptionService geneDescriptionService;

    public GeneDescriptionController(GeneDescriptionService geneDescriptionService) {
        this.geneDescriptionService = geneDescriptionService;
    }

    @GetMapping("/{symbol}/ncbi-summary")
    public ApiResponse<GeneDescriptionDto> getNcbiSummary(@PathVariable String symbol) {
        return ApiResponse.success(geneDescriptionService.fetchBySymbol(symbol).orElse(null));
    }
}
