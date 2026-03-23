package org.cfdna.database.service.impl;

import org.cfdna.database.dto.LabelCountDto;
import org.cfdna.database.dto.OverviewDto;
import org.cfdna.database.repository.BiomarkerRecordRepository;
import org.cfdna.database.repository.DatasetRepository;
import org.cfdna.database.repository.DownloadAssetRepository;
import org.cfdna.database.repository.StudyRepository;
import org.cfdna.database.service.OverviewService;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

@Service
public class OverviewServiceImpl implements OverviewService {

    private final StudyRepository studyRepository;
    private final BiomarkerRecordRepository biomarkerRecordRepository;
    private final DatasetRepository datasetRepository;
    private final DownloadAssetRepository downloadAssetRepository;

    public OverviewServiceImpl(
            StudyRepository studyRepository,
            BiomarkerRecordRepository biomarkerRecordRepository,
            DatasetRepository datasetRepository,
            DownloadAssetRepository downloadAssetRepository
    ) {
        this.studyRepository = studyRepository;
        this.biomarkerRecordRepository = biomarkerRecordRepository;
        this.datasetRepository = datasetRepository;
        this.downloadAssetRepository = downloadAssetRepository;
    }

    @Override
    public OverviewDto getOverview() {
        return new OverviewDto(
                studyRepository.count(),
                biomarkerRecordRepository.count(),
                datasetRepository.count(),
                downloadAssetRepository.count(),
                studyRepository.countByDiseaseType(PageRequest.of(0, 5)).stream()
                        .map(item -> new LabelCountDto(item.getLabel(), item.getCount()))
                        .toList(),
                studyRepository.countByTechnology(PageRequest.of(0, 5)).stream()
                        .map(item -> new LabelCountDto(item.getLabel(), item.getCount()))
                        .toList()
        );
    }
}
