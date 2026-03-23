package org.cfdna.database.service.impl;

import org.cfdna.database.dto.LabelCountDto;
import org.cfdna.database.dto.VisualizationSummaryDto;
import org.cfdna.database.dto.YearCountDto;
import org.cfdna.database.repository.BiomarkerRecordRepository;
import org.cfdna.database.repository.StudyRepository;
import org.cfdna.database.service.VisualizationService;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

@Service
public class VisualizationServiceImpl implements VisualizationService {

    private final StudyRepository studyRepository;
    private final BiomarkerRecordRepository biomarkerRecordRepository;

    public VisualizationServiceImpl(StudyRepository studyRepository, BiomarkerRecordRepository biomarkerRecordRepository) {
        this.studyRepository = studyRepository;
        this.biomarkerRecordRepository = biomarkerRecordRepository;
    }

    @Override
    public VisualizationSummaryDto getSummary() {
        return new VisualizationSummaryDto(
                studyRepository.countByDiseaseType(PageRequest.of(0, 10)).stream()
                        .map(item -> new LabelCountDto(item.getLabel(), item.getCount()))
                        .toList(),
                studyRepository.countByTechnology(PageRequest.of(0, 10)).stream()
                        .map(item -> new LabelCountDto(item.getLabel(), item.getCount()))
                        .toList(),
                biomarkerRecordRepository.countByMarkerType(PageRequest.of(0, 10)).stream()
                        .map(item -> new LabelCountDto(item.getLabel(), item.getCount()))
                        .toList(),
                studyRepository.countBySampleSource(PageRequest.of(0, 10)).stream()
                        .map(item -> new LabelCountDto(item.getLabel(), item.getCount()))
                        .toList(),
                studyRepository.countByPublicationYear().stream()
                        .filter(item -> item.getYear() != null)
                        .map(item -> new YearCountDto(item.getYear(), item.getCount()))
                        .toList()
        );
    }
}
