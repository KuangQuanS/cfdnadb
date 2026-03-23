package org.cfdna.database.service.impl;

import org.cfdna.database.domain.DownloadAsset;
import org.cfdna.database.dto.DownloadAssetDto;
import org.cfdna.database.exception.ResourceNotFoundException;
import org.cfdna.database.repository.DownloadAssetRepository;
import org.cfdna.database.service.DownloadService;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class DownloadServiceImpl implements DownloadService {

    private final DownloadAssetRepository downloadAssetRepository;

    public DownloadServiceImpl(DownloadAssetRepository downloadAssetRepository) {
        this.downloadAssetRepository = downloadAssetRepository;
    }

    @Override
    public List<DownloadAssetDto> listDownloads() {
        return downloadAssetRepository.findAllByOrderByCategoryAscNameAsc().stream()
                .map(this::toDto)
                .toList();
    }

    @Override
    public DownloadResource loadDownloadResource(Long id) throws IOException {
        DownloadAsset asset = downloadAssetRepository.findByIdAndPublicAssetTrue(id)
                .orElseThrow(() -> new ResourceNotFoundException("Download asset not found: " + id));
        Resource resource = new ClassPathResource(asset.getFilePath());
        if (!resource.exists()) {
            throw new ResourceNotFoundException("File not found for asset: " + asset.getFileName());
        }
        return new DownloadResource(resource, asset.getFileName(), asset.getContentType(), resource.contentLength());
    }

    private DownloadAssetDto toDto(DownloadAsset asset) {
        Long studyId = asset.getStudy() != null ? asset.getStudy().getId() : null;
        String studyAccession = asset.getStudy() != null ? asset.getStudy().getAccession() : null;
        return new DownloadAssetDto(
                asset.getId(),
                asset.getName(),
                asset.getCategory(),
                asset.getDescription(),
                asset.getFileName(),
                asset.getContentType(),
                asset.getFileSizeBytes(),
                asset.isPublicAsset(),
                studyId,
                studyAccession,
                "/api/v1/downloads/" + asset.getId() + "/file"
        );
    }
}
