package org.cfdna.database.dto;

public record DownloadAssetDto(
        Long id,
        String name,
        String category,
        String description,
        String fileName,
        String contentType,
        Long fileSizeBytes,
        boolean publicAsset,
        Long studyId,
        String studyAccession,
        String downloadUrl
) {
}

