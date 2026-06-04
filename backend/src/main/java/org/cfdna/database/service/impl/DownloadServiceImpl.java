package org.cfdna.database.service.impl;

import org.cfdna.database.domain.DownloadAsset;
import org.cfdna.database.dto.DownloadAssetDto;
import org.cfdna.database.exception.ResourceNotFoundException;
import org.cfdna.database.repository.DownloadAssetRepository;
import org.cfdna.database.service.DownloadService;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@Transactional(readOnly = true)
public class DownloadServiceImpl implements DownloadService {

    private static final long PUBLIC_STATS_ID_OFFSET = 1_000_000L;

    private final DownloadAssetRepository downloadAssetRepository;
    private final Path dataDir;

    public DownloadServiceImpl(DownloadAssetRepository downloadAssetRepository,
                               @Value("${app.data-dir:/400T/cfdnaweb}") String dataDir) {
        this.downloadAssetRepository = downloadAssetRepository;
        this.dataDir = Path.of(dataDir);
    }

    @Override
    public List<DownloadAssetDto> listDownloads() {
        List<DownloadAssetDto> rows = new ArrayList<>(downloadAssetRepository.findAllByOrderByCategoryAscNameAsc().stream()
                .map(this::toDto)
                .collect(Collectors.toList()));
        rows.addAll(listPublicMutationDownloads());
        return rows;
    }

    @Override
    public DownloadResource loadDownloadResource(Long id) throws IOException {
        if (id != null && id >= PUBLIC_STATS_ID_OFFSET) {
            PublicStatsAsset asset = findPublicStatsAsset(id)
                    .orElseThrow(() -> new ResourceNotFoundException("Download asset not found: " + id));
            Resource resource = new FileSystemResource(asset.path());
            if (!resource.exists()) {
                throw new ResourceNotFoundException("File not found for asset: " + asset.fileName());
            }
            return new DownloadResource(resource, asset.fileName(), "text/tab-separated-values", resource.contentLength());
        }

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

    private List<DownloadAssetDto> listPublicMutationDownloads() {
        return scanPublicStatsAssets().stream()
                .map(asset -> new DownloadAssetDto(
                        asset.id(),
                        asset.cancer() + " public mutation aggregate",
                        "Public mutation aggregate",
                        "Aggregated public cohort mutation table for " + asset.cancer() + ".",
                        asset.fileName(),
                        "text/tab-separated-values",
                        asset.sizeBytes(),
                        true,
                        null,
                        asset.dataset(),
                        "/api/v1/downloads/" + asset.id() + "/file"
                ))
                .collect(Collectors.toList());
    }

    private Optional<PublicStatsAsset> findPublicStatsAsset(long id) {
        return scanPublicStatsAssets().stream()
                .filter(asset -> asset.id() == id)
                .findFirst();
    }

    private List<PublicStatsAsset> scanPublicStatsAssets() {
        if (!Files.isDirectory(dataDir)) return List.of();
        try (Stream<Path> cancerDirs = Files.list(dataDir)) {
            List<Path> files = cancerDirs
                    .filter(Files::isDirectory)
                    .flatMap(this::listPublicStatsFiles)
                    .sorted(Comparator.comparing(path -> path.getParent().getParent().getParent().getFileName().toString().toLowerCase(Locale.ROOT)))
                    .collect(Collectors.toList());

            List<PublicStatsAsset> assets = new ArrayList<>();
            for (int index = 0; index < files.size(); index++) {
                Path file = files.get(index);
                String cancer = file.getParent().getParent().getParent().getFileName().toString();
                String fileName = file.getFileName().toString();
                assets.add(new PublicStatsAsset(
                        PUBLIC_STATS_ID_OFFSET + index,
                        cancer,
                        datasetFromFileName(fileName),
                        fileName,
                        file,
                        Files.size(file)
                ));
            }
            return assets;
        } catch (IOException exception) {
            return List.of();
        }
    }

    private Stream<Path> listPublicStatsFiles(Path cancerDir) {
        Path statsDir = cancerDir.resolve("public").resolve("stats");
        if (!Files.isDirectory(statsDir)) return Stream.empty();
        try {
            return Files.list(statsDir)
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith("_all_mutations.txt"));
        } catch (IOException exception) {
            return Stream.empty();
        }
    }

    private String datasetFromFileName(String fileName) {
        int idx = fileName.indexOf('_');
        return idx > 0 ? fileName.substring(0, idx) : "Public";
    }

    private static final class PublicStatsAsset {
        private final long id;
        private final String cancer;
        private final String dataset;
        private final String fileName;
        private final Path path;
        private final long sizeBytes;

        private PublicStatsAsset(long id, String cancer, String dataset, String fileName, Path path, long sizeBytes) {
            this.id = id;
            this.cancer = cancer;
            this.dataset = dataset;
            this.fileName = fileName;
            this.path = path;
            this.sizeBytes = sizeBytes;
        }

        private long id() { return id; }
        private String cancer() { return cancer; }
        private String dataset() { return dataset; }
        private String fileName() { return fileName; }
        private Path path() { return path; }
        private long sizeBytes() { return sizeBytes; }
    }
}
