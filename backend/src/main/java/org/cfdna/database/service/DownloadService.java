package org.cfdna.database.service;

import org.cfdna.database.dto.DownloadAssetDto;
import org.springframework.core.io.Resource;

import java.io.IOException;
import java.util.List;

public interface DownloadService {

    List<DownloadAssetDto> listDownloads();

    DownloadResource loadDownloadResource(Long id) throws IOException;

    final class DownloadResource {
        private final Resource resource;
        private final String fileName;
        private final String contentType;
        private final long fileSizeBytes;

        public DownloadResource(Resource resource, String fileName, String contentType, long fileSizeBytes) {
            this.resource = resource;
            this.fileName = fileName;
            this.contentType = contentType;
            this.fileSizeBytes = fileSizeBytes;
        }

        public Resource resource() { return resource; }
        public String fileName() { return fileName; }
        public String contentType() { return contentType; }
        public long fileSizeBytes() { return fileSizeBytes; }

        public Resource getResource() { return resource; }
        public String getFileName() { return fileName; }
        public String getContentType() { return contentType; }
        public long getFileSizeBytes() { return fileSizeBytes; }
    }
}
