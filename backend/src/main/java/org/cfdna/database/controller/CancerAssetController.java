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
import java.util.List;

@Validated
@RestController
@RequestMapping("/api/v1/cancers/assets")
public class CancerAssetController {

    private final DuckDbService duckDbService;

    public CancerAssetController(DuckDbService duckDbService) {
        this.duckDbService = duckDbService;
    }

    @GetMapping
    public ApiResponse<List<CancerAssetDto>> listCancerAssets(@RequestParam @NotBlank String cancer) {
        return ApiResponse.success(duckDbService.getCancerAssets(cancer));
    }

    @GetMapping("/{cancer}/file/{fileName:.+}")
    public ResponseEntity<Resource> openCancerAsset(
            @PathVariable String cancer,
            @PathVariable String fileName) {
        DuckDbService.CancerAssetResource result = duckDbService.loadCancerAsset(cancer, fileName);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(result.contentType()))
                .contentLength(result.fileSizeBytes())
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().filename(result.fileName()).build().toString())
                .body(result.resource());
    }
}
