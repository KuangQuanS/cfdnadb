package org.cfdna.database.dto;

public record StudySummaryDto(
        Long id,
        String accession,
        String title,
        String diseaseType,
        String sampleSource,
        String technology,
        String journal,
        Integer publicationYear,
        Integer cohortSize,
        long biomarkerCount,
        long datasetCount
) {
}
