package org.cfdna.database.controller;

import org.cfdna.database.dto.ApiResponse;
import org.cfdna.database.dto.PagedResponse;
import org.cfdna.database.dto.SampleBrowseItemDto;
import org.cfdna.database.dto.SampleDetailDto;
import org.cfdna.database.dto.SampleDownloadRequestDto;
import org.cfdna.database.service.DuckDbService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import java.time.LocalDate;
import java.util.List;

@Validated
@RestController
@RequestMapping("/api/v1/samples")
public class SampleController {

    private final DuckDbService duckDbService;

    public SampleController(DuckDbService duckDbService) {
        this.duckDbService = duckDbService;
    }

    @GetMapping
    public ApiResponse<PagedResponse<SampleBrowseItemDto>> listSamples(
            @RequestParam(required = false) List<String> cancer,
            @RequestParam(required = false) List<String> source,
            @RequestParam(required = false) String gene,
            @RequestParam(required = false) String sample,
            @RequestParam(required = false) Integer minVariants,
            @RequestParam(defaultValue = "false") boolean hasAnnotated,
            @RequestParam(defaultValue = "false") boolean hasSomatic,
            @RequestParam(defaultValue = "true") boolean includeTopGenes,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "25") @Min(1) @Max(200) int size) {
        return ApiResponse.success(
                duckDbService.listSamples(cancer, source, gene, sample, minVariants, hasAnnotated, hasSomatic, includeTopGenes, page, size));
    }

    @GetMapping("/detail")
    public ApiResponse<SampleDetailDto> getSampleDetail(
            @RequestParam String cancer,
            @RequestParam String source,
            @RequestParam String sampleId) {
        return ApiResponse.success(duckDbService.getSampleDetail(cancer, source, sampleId));
    }

    @PostMapping(value = "/download", produces = "application/zip")
    public ResponseEntity<StreamingResponseBody> downloadSamples(@RequestBody SampleDownloadRequestDto request) {
        String fileType = request.getFileType() == null ? "files" : request.getFileType().trim().toLowerCase();
        String fileName = "ctdnadb_" + fileType + "_samples_" + LocalDate.now() + ".zip";
        StreamingResponseBody body = outputStream -> duckDbService.writeSampleDownloadZip(request, outputStream);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                .contentType(MediaType.parseMediaType("application/zip"))
                .body(body);
    }
}
