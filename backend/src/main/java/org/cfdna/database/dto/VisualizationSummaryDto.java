package org.cfdna.database.dto;

import java.util.List;

public record VisualizationSummaryDto(
        List<LabelCountDto> diseaseDistribution,
        List<LabelCountDto> technologyDistribution,
        List<LabelCountDto> markerTypeDistribution,
        List<LabelCountDto> sampleSourceDistribution,
        List<YearCountDto> publicationTrend
) {
}
