package org.cfdna.database.controller;

import org.cfdna.database.dto.ApiResponse;
import org.cfdna.database.dto.GeneSummaryDto;
import org.cfdna.database.dto.GeneVariantDto;
import org.cfdna.database.dto.LabelCountDto;
import org.cfdna.database.dto.PagedResponse;
import org.cfdna.database.dto.TopGeneDto;
import org.cfdna.database.service.DuckDbService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import java.util.List;

@Validated
@RestController
@RequestMapping("/api/v1/variants")
public class VariantController {

    private final DuckDbService duckDbService;

    public VariantController(DuckDbService duckDbService) {
        this.duckDbService = duckDbService;
    }

    @GetMapping("/top-genes")
    public ApiResponse<List<TopGeneDto>> getTopGenes(
            @RequestParam String cancer,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int limit) {
        return ApiResponse.success(duckDbService.getTopGenes(cancer, limit));
    }

    @GetMapping("/by-gene")
    public ApiResponse<PagedResponse<GeneVariantDto>> getVariantsByGene(
            @RequestParam String cancer,
            @RequestParam @NotBlank String gene,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "50") @Min(1) @Max(200) int pageSize) {
        return ApiResponse.success(duckDbService.getVariantsByGene(cancer, gene, page, pageSize));
    }

    @GetMapping("/browse")
    public ApiResponse<PagedResponse<GeneVariantDto>> browseVariants(
            @RequestParam String cancer,
            @RequestParam(required = false) String gene,
            @RequestParam(required = false) String funcClass,
            @RequestParam(required = false) String exonicFunc,
            @RequestParam(required = false) String chr,
            @RequestParam(required = false) String sample,
            @RequestParam(required = false) Long startMin,
            @RequestParam(required = false) Long startMax,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "25") @Min(1) @Max(200) int pageSize) {
        return ApiResponse.success(duckDbService.getVariants(cancer, gene, funcClass, exonicFunc, chr, sample, startMin, startMax, page, pageSize));
    }

    @GetMapping("/gene-summary")
    public ApiResponse<GeneSummaryDto> getGeneSummary(
            @RequestParam String cancer,
            @RequestParam @NotBlank String gene) {
        return ApiResponse.success(duckDbService.getGeneSummary(cancer, gene));
    }

    @GetMapping("/all-genes")
    public ApiResponse<List<String>> getAllGenes(@RequestParam String cancer) {
        return ApiResponse.success(duckDbService.getAllGenes(cancer));
    }

    @GetMapping("/gene-suggestions")
    public ApiResponse<List<String>> getGeneSuggestions(
            @RequestParam String cancer,
            @RequestParam String q,
            @RequestParam(defaultValue = "10") @Min(1) @Max(30) int limit) {
        return ApiResponse.success(duckDbService.getGeneSuggestions(cancer, q, limit));
    }

    @GetMapping("/func-distribution")
    public ApiResponse<List<LabelCountDto>> getFuncDistribution(@RequestParam String cancer) {
        return ApiResponse.success(duckDbService.getFuncDistribution(cancer));
    }

    @GetMapping("/exonic-distribution")
    public ApiResponse<List<LabelCountDto>> getExonicDistribution(@RequestParam String cancer) {
        return ApiResponse.success(duckDbService.getExonicDistribution(cancer));
    }

    @GetMapping("/chrom-distribution")
    public ApiResponse<List<LabelCountDto>> getChromDistribution(@RequestParam String cancer) {
        return ApiResponse.success(duckDbService.getChromDistribution(cancer));
    }

    @GetMapping("/sample-burden")
    public ApiResponse<List<LabelCountDto>> getSampleBurden(
            @RequestParam String cancer,
            @RequestParam(defaultValue = "30") @Min(5) @Max(100) int limit) {
        return ApiResponse.success(duckDbService.getSampleBurden(cancer, limit));
    }
}
