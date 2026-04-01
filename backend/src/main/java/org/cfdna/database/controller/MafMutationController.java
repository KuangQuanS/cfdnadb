package org.cfdna.database.controller;

import org.cfdna.database.dto.ApiResponse;
import org.cfdna.database.dto.MafFilterOptionsDto;
import org.cfdna.database.dto.MafMutationDto;
import org.cfdna.database.dto.PagedResponse;
import org.cfdna.database.service.DuckDbService;
import org.springframework.web.bind.annotation.GetMapping;
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
            @RequestParam(required = false) String cancerType,
            @RequestParam(required = false) String chromosome,
            @RequestParam(required = false) String variantClass,
            @RequestParam(required = false) String variantType,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(
                duckDbService.queryMafMutations(source, gene, cancerType, chromosome, variantClass, variantType, page, size));
    }

    @GetMapping("/filter-options")
    public ApiResponse<MafFilterOptionsDto> filterOptions(
            @RequestParam(defaultValue = "cfDNA") String source) {
        return ApiResponse.success(duckDbService.getMafFilterOptions(source));
    }
}
