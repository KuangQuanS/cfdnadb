package org.cfdna.database.controller;

import org.cfdna.database.dto.ApiResponse;
import org.cfdna.database.dto.MafFilterOptionsDto;
import org.cfdna.database.dto.MafGeneSummaryDto;
import org.cfdna.database.dto.MafMutationDto;
import org.cfdna.database.dto.MafSummaryDto;
import org.cfdna.database.dto.OncoplottDto;
import org.cfdna.database.dto.PagedResponse;
import org.cfdna.database.service.DuckDbService;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/maf-mutations")
public class MafMutationController {

    private final DuckDbService duckDbService;

    public MafMutationController(DuckDbService duckDbService) {
        this.duckDbService = duckDbService;
    }

    @GetMapping
    public ApiResponse<PagedResponse<MafMutationDto>> queryMutations(
            @RequestParam(defaultValue = "cfDNA") String source,
            @RequestParam(required = false) String gene,
            @RequestParam(required = false) String sample,
            @RequestParam(required = false) List<String> cancerType,
            @RequestParam(required = false) List<String> chromosome,
            @RequestParam(required = false) List<String> variantClass,
            @RequestParam(required = false) List<String> variantType,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(
                duckDbService.queryMafMutations(source, gene, sample, cancerType, chromosome, variantClass, variantType, page, size));
    }

    @GetMapping("/genes")
    public ApiResponse<PagedResponse<MafGeneSummaryDto>> queryGenes(
            @RequestParam(defaultValue = "cfDNA") String source,
            @RequestParam(required = false) String gene,
            @RequestParam(required = false) String sample,
            @RequestParam(required = false) List<String> cancerType,
            @RequestParam(required = false) List<String> chromosome,
            @RequestParam(required = false) List<String> variantClass,
            @RequestParam(required = false) List<String> variantType,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(
                duckDbService.queryMafGenes(source, gene, sample, cancerType, chromosome, variantClass, variantType, page, size));
    }

    @GetMapping("/genes/{gene}")
    public ApiResponse<MafGeneSummaryDto> geneDetail(
            @PathVariable String gene,
            @RequestParam(defaultValue = "cfDNA") String source,
            @RequestParam(required = false) String sample,
            @RequestParam(required = false) List<String> cancerType,
            @RequestParam(required = false) List<String> chromosome,
            @RequestParam(required = false) List<String> variantClass,
            @RequestParam(required = false) List<String> variantType) {
        return ApiResponse.success(
                duckDbService.getMafGeneDetail(source, gene, sample, cancerType, chromosome, variantClass, variantType));
    }

    @GetMapping("/genes/{gene}/mutations")
    public ApiResponse<PagedResponse<MafMutationDto>> queryGeneMutations(
            @PathVariable String gene,
            @RequestParam(defaultValue = "cfDNA") String source,
            @RequestParam(required = false) String sample,
            @RequestParam(required = false) List<String> cancerType,
            @RequestParam(required = false) List<String> chromosome,
            @RequestParam(required = false) List<String> variantClass,
            @RequestParam(required = false) List<String> variantType,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(
                duckDbService.queryMafMutationsByGene(source, gene, sample, cancerType, chromosome, variantClass, variantType, page, size));
    }

    @GetMapping("/filter-options")
    public ApiResponse<MafFilterOptionsDto> filterOptions(
            @RequestParam(defaultValue = "cfDNA") String source) {
        return ApiResponse.success(duckDbService.getMafFilterOptions(source));
    }

    @GetMapping("/summary")
    public ApiResponse<MafSummaryDto> summary(
            @RequestParam(defaultValue = "cfDNA") String source,
            @RequestParam(required = false) String gene,
            @RequestParam(required = false) String sample,
            @RequestParam(required = false) List<String> cancerType,
            @RequestParam(required = false) List<String> chromosome,
            @RequestParam(required = false) List<String> variantClass,
            @RequestParam(required = false) List<String> variantType) {
        return ApiResponse.success(
                duckDbService.getMafSummary(source, gene, sample, cancerType, chromosome, variantClass, variantType));
    }

    @GetMapping("/gene-suggestions")
    public ApiResponse<List<String>> geneSuggestions(
            @RequestParam(defaultValue = "cfDNA") String source,
            @RequestParam String q,
            @RequestParam(defaultValue = "10") int limit) {
        return ApiResponse.success(duckDbService.getMafSuggestions(source, "Hugo_Symbol", q, limit));
    }

    @GetMapping("/sample-suggestions")
    public ApiResponse<List<String>> sampleSuggestions(
            @RequestParam(defaultValue = "cfDNA") String source,
            @RequestParam String q,
            @RequestParam(defaultValue = "10") int limit) {
        return ApiResponse.success(duckDbService.getMafSuggestions(source, "Tumor_Sample_Barcode", q, limit));
    }

    @GetMapping("/oncoplot")
    public ApiResponse<OncoplottDto> getOncoplot(
            @RequestParam(defaultValue = "cfDNA") String source,
            @RequestParam(required = false) List<String> cancerType,
            @RequestParam(required = false) List<String> gene,
            @RequestParam(defaultValue = "20") int limit) {
        return ApiResponse.success(duckDbService.getOncoplottData(source, cancerType, gene, limit));
    }
}
