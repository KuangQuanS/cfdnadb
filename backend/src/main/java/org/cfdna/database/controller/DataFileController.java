package org.cfdna.database.controller;

import org.cfdna.database.dto.ApiResponse;
import org.cfdna.database.dto.DataFileDto;
import org.cfdna.database.service.DuckDbService;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/data-files")
public class DataFileController {

    private final DuckDbService duckDbService;

    public DataFileController(DuckDbService duckDbService) {
        this.duckDbService = duckDbService;
    }

    @GetMapping
    public ApiResponse<List<DataFileDto>> listDataFiles() {
        return ApiResponse.success(duckDbService.listDataFiles());
    }

    @GetMapping("/{category}/{fileName:.+}")
    public ResponseEntity<Resource> downloadFile(
            @PathVariable String category,
            @PathVariable String fileName) {
        Resource resource = duckDbService.loadDataFile(category, fileName);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                .header(HttpHeaders.CONTENT_TYPE, "text/plain")
                .body(resource);
    }

    @GetMapping("/{category}/maf/{fileName:.+}")
    public ResponseEntity<Resource> downloadMafFile(
            @PathVariable String category,
            @PathVariable String fileName) {
        Resource resource = duckDbService.loadDataFile(category, "maf/" + fileName);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                .header(HttpHeaders.CONTENT_TYPE, "text/plain")
                .body(resource);
    }
}
