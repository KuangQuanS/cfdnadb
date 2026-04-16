package org.cfdna.database.controller;

import org.cfdna.database.dto.ApiResponse;
import org.cfdna.database.service.SurvivalAnalysisService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/survival")
public class SurvivalController {

    private final SurvivalAnalysisService service;

    public SurvivalController(SurvivalAnalysisService service) {
        this.service = service;
    }

    @GetMapping("/cohorts")
    public ApiResponse<List<String>> cohorts() {
        return ApiResponse.success(service.listCohorts());
    }

    @GetMapping("/km")
    public ApiResponse<SurvivalAnalysisService.KmResult> km(
            @RequestParam String cohort,
            @RequestParam String gene,
            @RequestParam(defaultValue = "mutation_status") String groupBy,
            @RequestParam(defaultValue = "months") String timeUnit) {
        SurvivalAnalysisService.KmResult result = "mutation_type".equalsIgnoreCase(groupBy)
                ? service.kmByMutationType(cohort, gene, timeUnit)
                : service.kmByMutationStatus(cohort, gene, timeUnit);
        return ApiResponse.success(result);
    }

    @GetMapping("/vaf-stage")
    public ApiResponse<SurvivalAnalysisService.VafResult> vafStage(
            @RequestParam String cohort,
            @RequestParam String gene) {
        return ApiResponse.success(service.vafByStage(cohort, gene));
    }

    @GetMapping("/vaf-mutation")
    public ApiResponse<SurvivalAnalysisService.VafResult> vafMutation(
            @RequestParam String cohort,
            @RequestParam String gene) {
        return ApiResponse.success(service.vafByMutationType(cohort, gene));
    }
}
