package org.cfdna.database.service;

import org.cfdna.database.dto.DownloadAssetDto;
import org.springframework.core.io.Resource;

import java.io.IOException;
import java.util.List;

public interface DownloadService {

    List<DownloadAssetDto> listDownloads();

    DownloadResource loadDownloadResource(Long id) throws IOException;

    record DownloadResource(
            Resource resource,
            String fileName,
            String contentType,
            long fileSizeBytes
    ) {
    }
}
