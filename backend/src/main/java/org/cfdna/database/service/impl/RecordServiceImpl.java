package org.cfdna.database.service.impl;

import org.cfdna.database.domain.BiomarkerRecord;
import org.cfdna.database.dto.BiomarkerRecordDto;
import org.cfdna.database.dto.PagedResponse;
import org.cfdna.database.dto.RecordSearchRequest;
import org.cfdna.database.repository.BiomarkerRecordRepository;
import org.cfdna.database.service.RecordService;
import org.cfdna.database.specification.BiomarkerRecordSpecification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class RecordServiceImpl implements RecordService {

    private final BiomarkerRecordRepository biomarkerRecordRepository;

    public RecordServiceImpl(BiomarkerRecordRepository biomarkerRecordRepository) {
        this.biomarkerRecordRepository = biomarkerRecordRepository;
    }

    @Override
    public PagedResponse<BiomarkerRecordDto> searchRecords(RecordSearchRequest request) {
        Pageable pageable = PageRequest.of(
                Math.max(request.getPage(), 0),
                Math.min(Math.max(request.getSize(), 1), 100),
                Sort.by(Sort.Direction.fromString(request.getSortDir()), request.getSortBy())
        );

        Page<BiomarkerRecord> page = biomarkerRecordRepository.findAll(
                BiomarkerRecordSpecification.withFilters(request),
                pageable
        );

        return new PagedResponse<>(
                page.getContent().stream().map(this::toDto).toList(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.isFirst(),
                page.isLast()
        );
    }

    private BiomarkerRecordDto toDto(BiomarkerRecord entity) {
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
}
