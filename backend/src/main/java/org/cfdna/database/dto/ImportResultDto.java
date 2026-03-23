package org.cfdna.database.dto;

import java.util.List;

public record ImportResultDto(
        int importedStudies,
        List<String> importedAccessions
) {
}

