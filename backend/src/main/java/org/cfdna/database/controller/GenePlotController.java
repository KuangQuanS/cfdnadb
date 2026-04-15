package org.cfdna.database.controller;

import org.cfdna.database.dto.ApiResponse;
import org.cfdna.database.dto.GenePlotDto;
import org.cfdna.database.service.DuckDbService;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.validation.constraints.NotBlank;
import java.util.List;

@Validated
@RestController
@RequestMapping("/api/v1/gene-plots")
public class GenePlotController {

    private final DuckDbService duckDbService;

    public GenePlotController(DuckDbService duckDbService) {
        this.duckDbService = duckDbService;
    }

    /**
     * List lollipop plots for a gene.
     * - cancers omitted or empty → scan all 15 cohorts
     * - cancers provided → scan only the listed cohorts
     */
    @GetMapping
    public ApiResponse<List<GenePlotDto>> listGenePlots(
            @RequestParam @NotBlank String gene,
            @RequestParam(required = false) List<String> cancer) {
        return ApiResponse.success(duckDbService.getGeneLollipopPlots(gene, cancer));
    }

    @GetMapping("/{cancer}/file/{fileName:.+}")
    public ResponseEntity<Resource> serveGenePlot(
            @PathVariable String cancer,
            @PathVariable String fileName) {
        DuckDbService.CancerAssetResource result = duckDbService.loadGenePlot(cancer, fileName);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(result.fileSizeBytes())
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().filename(result.fileName()).build().toString())
                .body(result.resource());
    }
}
