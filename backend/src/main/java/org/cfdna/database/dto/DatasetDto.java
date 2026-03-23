package org.cfdna.database.dto;

public record DatasetDto(
        Long id,
        String name,
        String description,
        String dataType,
        Integer recordCount,
        String fileFormat,
        String releaseVersion
) {
}

