package org.cfdna.database.dto;

import java.util.List;

public record StudyDetailDto(
        Long id,
        String accession,
        String title,
        String diseaseType,
        String sampleSource,
        String technology,
        String journal,
        Integer publicationYear,
        String doi,
        String pmid,
        String abstractText,
        Integer cohortSize,
        String citation,
        List<DatasetDto> datasets,
        List<SampleGroupDto> sampleGroups,
        List<BiomarkerRecordDto> biomarkers,
        List<DownloadAssetDto> downloads
) {
}
