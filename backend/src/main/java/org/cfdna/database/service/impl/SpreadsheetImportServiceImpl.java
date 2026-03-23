package org.cfdna.database.service.impl;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.cfdna.database.domain.Study;
import org.cfdna.database.dto.ImportResultDto;
import org.cfdna.database.repository.StudyRepository;
import org.cfdna.database.service.SpreadsheetImportService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class SpreadsheetImportServiceImpl implements SpreadsheetImportService {

    private final StudyRepository studyRepository;

    public SpreadsheetImportServiceImpl(StudyRepository studyRepository) {
        this.studyRepository = studyRepository;
    }

    @Override
    @Transactional
    public ImportResultDto importStudiesCsv(InputStream inputStream) throws IOException {
        try (CSVParser parser = CSVFormat.DEFAULT.builder()
                .setHeader()
                .setSkipHeaderRecord(true)
                .build()
                .parse(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            List<String> importedAccessions = new ArrayList<>();
            for (CSVRecord record : parser) {
                String accession = record.get("accession");
                if (studyRepository.findByAccession(accession).isPresent()) {
                    continue;
                }
                Study study = new Study();
                study.setAccession(accession);
                study.setTitle(record.get("title"));
                study.setDiseaseType(record.get("disease_type"));
                study.setSampleSource(record.get("sample_source"));
                study.setTechnology(record.get("technology"));
                study.setJournal(record.get("journal"));
                study.setPublicationYear(parseInteger(record.get("publication_year")));
                study.setDoi(record.get("doi"));
                study.setPmid(record.get("pmid"));
                study.setAbstractText(record.get("abstract_text"));
                study.setCohortSize(parseInteger(record.get("cohort_size")));
                study.setCitation(record.get("citation"));
                study.setCreatedAt(LocalDateTime.now());
                study.setUpdatedAt(LocalDateTime.now());
                studyRepository.save(study);
                importedAccessions.add(accession);
            }
            return new ImportResultDto(importedAccessions.size(), importedAccessions);
        }
    }

    private Integer parseInteger(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return Integer.valueOf(value.trim());
    }
}
