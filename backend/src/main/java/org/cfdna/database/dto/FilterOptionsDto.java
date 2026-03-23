package org.cfdna.database.dto;

import java.util.List;

public record FilterOptionsDto(
        List<String> diseaseTypes,
        List<String> sampleSources,
        List<String> technologies,
        List<String> markerTypes,
        List<String> specimenTypes,
        List<Integer> publicationYears
) {
}

