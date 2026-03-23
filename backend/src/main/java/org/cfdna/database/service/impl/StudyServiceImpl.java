package org.cfdna.database.service.impl;

import org.cfdna.database.domain.BiomarkerRecord;
import org.cfdna.database.domain.Dataset;
import org.cfdna.database.domain.DownloadAsset;
import org.cfdna.database.domain.SampleGroup;
import org.cfdna.database.domain.Study;
import org.cfdna.database.dto.BiomarkerRecordDto;
import org.cfdna.database.dto.DatasetDto;
import org.cfdna.database.dto.DownloadAssetDto;
import org.cfdna.database.dto.PagedResponse;
import org.cfdna.database.dto.SampleGroupDto;
import org.cfdna.database.dto.StudyDetailDto;
import org.cfdna.database.dto.StudyQueryRequest;
import org.cfdna.database.dto.StudySummaryDto;
import org.cfdna.database.exception.ResourceNotFoundException;
import org.cfdna.database.repository.BiomarkerRecordRepository;
import org.cfdna.database.repository.DatasetRepository;
import org.cfdna.database.repository.DownloadAssetRepository;
import org.cfdna.database.repository.SampleGroupRepository;
import org.cfdna.database.repository.StudyRepository;
import org.cfdna.database.service.StudyService;
import org.cfdna.database.specification.StudySpecification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class StudyServiceImpl implements StudyService {

    private final StudyRepository studyRepository;
    private final DatasetRepository datasetRepository;
    private final SampleGroupRepository sampleGroupRepository;
    private final BiomarkerRecordRepository biomarkerRecordRepository;
    private final DownloadAssetRepository downloadAssetRepository;

    public StudyServiceImpl(
            StudyRepository studyRepository,
            DatasetRepository datasetRepository,
            SampleGroupRepository sampleGroupRepository,
            BiomarkerRecordRepository biomarkerRecordRepository,
            DownloadAssetRepository downloadAssetRepository
    ) {
        this.studyRepository = studyRepository;
        this.datasetRepository = datasetRepository;
        this.sampleGroupRepository = sampleGroupRepository;
        this.biomarkerRecordRepository = biomarkerRecordRepository;
        this.downloadAssetRepository = downloadAssetRepository;
    }

    @Override
    public PagedResponse<StudySummaryDto> listStudies(StudyQueryRequest request) {
        Pageable pageable = PageRequest.of(
                Math.max(request.getPage(), 0),
                Math.min(Math.max(request.getSize(), 1), 100),
                Sort.by(Sort.Direction.fromString(request.getSortDir()), request.getSortBy())
        );
        Page<Study> page = studyRepository.findAll(StudySpecification.withFilters(request), pageable);

        return new PagedResponse<>(
                page.getContent().stream().map(this::toSummaryDto).toList(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.isFirst(),
                page.isLast()
        );
    }

    @Override
    public StudyDetailDto getStudy(Long id) {
        Study study = studyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Study not found: " + id));
        List<DatasetDto> datasets = datasetRepository.findByStudyIdOrderByIdAsc(id).stream().map(this::toDatasetDto).toList();
        List<SampleGroupDto> sampleGroups = sampleGroupRepository.findByDatasetStudyIdOrderByDatasetIdAscIdAsc(id).stream()
                .map(this::toSampleGroupDto)
                .toList();
        List<BiomarkerRecordDto> biomarkers = biomarkerRecordRepository.findTop10ByStudyIdOrderByIdAsc(id).stream()
                .map(this::toBiomarkerDto)
                .toList();
        List<DownloadAssetDto> downloads = downloadAssetRepository.findByStudyIdOrderByNameAsc(id).stream()
                .map(this::toDownloadDto)
                .toList();

        return new StudyDetailDto(
                study.getId(),
                study.getAccession(),
                study.getTitle(),
                study.getDiseaseType(),
                study.getSampleSource(),
                study.getTechnology(),
                study.getJournal(),
                study.getPublicationYear(),
                study.getDoi(),
                study.getPmid(),
                study.getAbstractText(),
                study.getCohortSize(),
                study.getCitation(),
                datasets,
                sampleGroups,
                biomarkers,
                downloads
        );
    }

    private StudySummaryDto toSummaryDto(Study study) {
        return new StudySummaryDto(
                study.getId(),
                study.getAccession(),
                study.getTitle(),
                study.getDiseaseType(),
                study.getSampleSource(),
                study.getTechnology(),
                study.getJournal(),
                study.getPublicationYear(),
                study.getCohortSize(),
                biomarkerRecordRepository.countByStudyId(study.getId()),
                datasetRepository.countByStudyId(study.getId())
        );
    }

    private DatasetDto toDatasetDto(Dataset dataset) {
        return new DatasetDto(
                dataset.getId(),
                dataset.getName(),
                dataset.getDescription(),
                dataset.getDataType(),
                dataset.getRecordCount(),
                dataset.getFileFormat(),
                dataset.getReleaseVersion()
        );
    }

    private SampleGroupDto toSampleGroupDto(SampleGroup sampleGroup) {
        return new SampleGroupDto(
                sampleGroup.getId(),
                sampleGroup.getDataset().getId(),
                sampleGroup.getGroupName(),
                sampleGroup.getConditionName(),
                sampleGroup.getSampleType(),
                sampleGroup.getSampleCount()
        );
    }

    private BiomarkerRecordDto toBiomarkerDto(BiomarkerRecord entity) {
        return new BiomarkerRecordDto(
                entity.getId(),
                entity.getMarkerName(),
                entity.getMarkerType(),
                entity.getChromosomeLocation(),
                entity.getRegulationDirection(),
                entity.getAssayPlatform(),
                entity.getSpecimenType(),
                entity.getDiseaseType(),
                entity.getSignificanceMetric(),
                entity.getSignificanceValue(),
                entity.getEffectSize(),
                entity.getNotes(),
                entity.getStudy().getId(),
                entity.getStudy().getAccession(),
                entity.getStudy().getTitle(),
                entity.getStudy().getPublicationYear()
        );
    }

    private DownloadAssetDto toDownloadDto(DownloadAsset asset) {
        return new DownloadAssetDto(
                asset.getId(),
                asset.getName(),
                asset.getCategory(),
                asset.getDescription(),
                asset.getFileName(),
                asset.getContentType(),
                asset.getFileSizeBytes(),
                asset.isPublicAsset(),
                asset.getStudy() != null ? asset.getStudy().getId() : null,
                asset.getStudy() != null ? asset.getStudy().getAccession() : null,
                "/api/v1/downloads/" + asset.getId() + "/file"
        );
    }
}
