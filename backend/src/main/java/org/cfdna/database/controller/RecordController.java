package org.cfdna.database.controller;

import org.cfdna.database.dto.ApiResponse;
import org.cfdna.database.dto.BiomarkerRecordDto;
import org.cfdna.database.dto.PagedResponse;
import org.cfdna.database.dto.RecordSearchRequest;
import org.cfdna.database.service.RecordService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/records")
public class RecordController {

    private final RecordService recordService;

    public RecordController(RecordService recordService) {
        this.recordService = recordService;
    }

    @GetMapping
    public ApiResponse<PagedResponse<BiomarkerRecordDto>> searchRecords(RecordSearchRequest request) {
        return ApiResponse.success(recordService.searchRecords(request));
    }
}
