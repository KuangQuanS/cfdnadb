package org.cfdna.database.controller;

import org.cfdna.database.dto.ApiResponse;
import org.cfdna.database.dto.VafBodyMapDto;
import org.cfdna.database.service.VafAnalysisService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/vaf")
public class VafAnalysisController {

    private final VafAnalysisService vafAnalysisService;

    public VafAnalysisController(VafAnalysisService vafAnalysisService) {
        this.vafAnalysisService = vafAnalysisService;
    }

    @GetMapping("/bodymap")
    public ApiResponse<VafBodyMapDto> bodyMap(@RequestParam String gene) {
        return ApiResponse.success(vafAnalysisService.getBodyMap(gene));
    }
}
