package org.cfdna.database.dto;

public record SampleGroupDto(
        Long id,
        Long datasetId,
        String groupName,
        String conditionName,
        String sampleType,
        Integer sampleCount
) {
}
