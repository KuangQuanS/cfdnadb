package org.cfdna.database.controller;

import org.cfdna.database.dto.ApiResponse;
import org.cfdna.database.dto.CancerAssetDto;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Validated
@RestController
@RequestMapping("/api/v1/statistics")
public class StatisticsController {

    private final DuckDbService duckDbService;

    public StatisticsController(DuckDbService duckDbService) {
        this.duckDbService = duckDbService;
    }

    /** List available data sources (Private_cfDNA, GEO, TCGA, Overview) for a cancer. */
    @GetMapping("/{cancer}/sources")
    public ApiResponse<List<Map<String, Object>>> listSources(@PathVariable @NotBlank String cancer) {
        List<String> sources = duckDbService.getStatisticsSources(cancer);
        List<Map<String, Object>> result = sources.stream().map(src -> {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("source", src);
            entry.put("hasGenePlots", duckDbService.hasGenePlots(cancer, src));
            return entry;
        }).toList();
        return ApiResponse.success(result);
    }

    /** List PDF plot assets for a cancer + data source. */
    @GetMapping("/{cancer}/plots")
    public ApiResponse<List<CancerAssetDto>> listPlots(
            @PathVariable @NotBlank String cancer,
            @RequestParam @NotBlank String source) {
        return ApiResponse.success(duckDbService.getStatisticsPlots(cancer, source));
    }

    /** Serve a specific plot PDF file. */
    @GetMapping("/{cancer}/plots/file")
    public ResponseEntity<Resource> servePlot(
            @PathVariable String cancer,
            @RequestParam @NotBlank String source,
            @RequestParam @NotBlank String fileName) {
        DuckDbService.CancerAssetResource result = duckDbService.loadStatisticsPlot(cancer, source, fileName);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(result.fileSizeBytes())
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().filename(result.fileName()).build().toString())
                .body(result.resource());
    }

    /** Autocomplete gene names for lollipop plots. */
    @GetMapping("/{cancer}/genes")
    public ApiResponse<List<String>> listGenes(
            @PathVariable @NotBlank String cancer,
            @RequestParam @NotBlank String source,
            @RequestParam(defaultValue = "") String query) {
        return ApiResponse.success(duckDbService.getGenePlotNames(cancer, source, query));
    }

    /** Serve a gene lollipop plot PDF. */
    @GetMapping("/{cancer}/gene-plot")
    public ResponseEntity<Resource> serveGenePlot(
            @PathVariable String cancer,
            @RequestParam @NotBlank String source,
            @RequestParam @NotBlank String gene) {
        DuckDbService.CancerAssetResource result = duckDbService.loadGenePlot(cancer, source, gene);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(result.fileSizeBytes())
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().filename(result.fileName()).build().toString())
                .body(result.resource());
    }
}
