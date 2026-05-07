package org.cfdna.database.controller;

import org.cfdna.database.dto.ApiResponse;
import org.cfdna.database.dto.CohortFileDto;
import org.cfdna.database.dto.LabelCountDto;
import org.cfdna.database.service.CsvStatisticsService;
import org.cfdna.database.service.DuckDbService;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/cohort")
public class CohortFileController {

    private final DuckDbService duckDbService;
    private final CsvStatisticsService csvStatisticsService;

    public CohortFileController(DuckDbService duckDbService, CsvStatisticsService csvStatisticsService) {
        this.duckDbService = duckDbService;
        this.csvStatisticsService = csvStatisticsService;
    }

    @GetMapping("/files")
    public ApiResponse<List<CohortFileDto>> listFiles(
            @RequestParam String cancer,
            @RequestParam(required = false) String source,
            @RequestParam(required = false) String category) {
        return ApiResponse.success(duckDbService.listCohortFiles(cancer, source, category));
    }

    @GetMapping("/source-distribution")
    public ApiResponse<List<LabelCountDto>> getSourceDistribution(@RequestParam(required = false) String cancer) {
        if (cancer == null || cancer.isBlank()) {
            return ApiResponse.success(csvStatisticsService.readHomeSourceSamples().orElseGet(List::of));
        }
        return ApiResponse.success(List.of());
    }

    @GetMapping("/files/download/{cancer}/{source}/{category}/{fileName:.+}")
    public ResponseEntity<Resource> downloadFile(
            @PathVariable String cancer,
            @PathVariable String source,
            @PathVariable String category,
            @PathVariable String fileName) {
        Resource resource = duckDbService.loadCohortFile(cancer, source, category, fileName);
        String contentType = fileName.endsWith(".gz") ? "application/gzip" :
                             fileName.endsWith(".vcf") ? "text/plain" :
                             "application/octet-stream";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                .contentType(MediaType.parseMediaType(contentType))
                .body(resource);
    }
}
