package org.cfdna.database.service.impl;

import org.cfdna.database.dto.FilterOptionsDto;
import org.cfdna.database.repository.BiomarkerRecordRepository;
import org.cfdna.database.repository.StudyRepository;
import org.cfdna.database.service.MetadataService;
import org.springframework.stereotype.Service;

@Service
public class MetadataServiceImpl implements MetadataService {

    private final StudyRepository studyRepository;
    private final BiomarkerRecordRepository biomarkerRecordRepository;

    public MetadataServiceImpl(StudyRepository studyRepository, BiomarkerRecordRepository biomarkerRecordRepository) {
        this.studyRepository = studyRepository;
        this.biomarkerRecordRepository = biomarkerRecordRepository;
    }

    @Override
    public FilterOptionsDto getFilterOptions() {
        return new FilterOptionsDto(
                studyRepository.findDistinctDiseaseTypes(),
                studyRepository.findDistinctSampleSources(),
                studyRepository.findDistinctTechnologies(),
                biomarkerRecordRepository.findDistinctMarkerTypes(),
                biomarkerRecordRepository.findDistinctSpecimenTypes(),
                studyRepository.findDistinctPublicationYears()
        );
    }
}
