package org.cfdna.database.controller;

import org.cfdna.database.dto.ApiResponse;
import org.cfdna.database.dto.PagedResponse;
import org.cfdna.database.dto.StudyDetailDto;
import org.cfdna.database.dto.StudyQueryRequest;
import org.cfdna.database.dto.StudySummaryDto;
import org.cfdna.database.service.StudyService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/studies")
public class StudyController {

    private final StudyService studyService;

    public StudyController(StudyService studyService) {
        this.studyService = studyService;
    }

    @GetMapping
    public ApiResponse<PagedResponse<StudySummaryDto>> listStudies(StudyQueryRequest request) {
        return ApiResponse.success(studyService.listStudies(request));
    }

    @GetMapping("/{id}")
    public ApiResponse<StudyDetailDto> getStudy(@PathVariable Long id) {
        return ApiResponse.success(studyService.getStudy(id));
    }
}
