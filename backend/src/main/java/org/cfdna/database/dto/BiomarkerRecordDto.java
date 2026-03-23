package org.cfdna.database.dto;

import java.math.BigDecimal;

public record BiomarkerRecordDto(
        Long id,
        String markerName,
        String markerType,
        String chromosomeLocation,
        String regulationDirection,
        String assayPlatform,
        String specimenType,
        String diseaseType,
        String significanceMetric,
        BigDecimal significanceValue,
        BigDecimal effectSize,
        String notes,
        Long studyId,
        String studyAccession,
        String studyTitle,
        Integer publicationYear
) {
}

