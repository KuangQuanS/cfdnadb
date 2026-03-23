package org.cfdna.database.dto;

import java.util.List;

public record OverviewDto(
        long studyCount,
        long biomarkerCount,
        long datasetCount,
        long downloadableAssets,
        List<LabelCountDto> leadingDiseases,
        List<LabelCountDto> leadingTechnologies
) {
}
