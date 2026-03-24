package org.cfdna.database.dto;

import java.util.List;

public class StudyDetailDto {

    private final Long id;
    private final String accession;
    private final String title;
    private final String diseaseType;
    private final String sampleSource;
    private final String technology;
    private final String journal;
    private final Integer publicationYear;
    private final String doi;
    private final String pmid;
    private final String abstractText;
    private final Integer cohortSize;
    private final String citation;
    private final List<DatasetDto> datasets;
    private final List<SampleGroupDto> sampleGroups;
    private final List<BiomarkerRecordDto> biomarkers;
    private final List<DownloadAssetDto> downloads;

    public StudyDetailDto(Long id, String accession, String title, String diseaseType, String sampleSource,
                          String technology, String journal, Integer publicationYear, String doi, String pmid,
                          String abstractText, Integer cohortSize, String citation, List<DatasetDto> datasets,
                          List<SampleGroupDto> sampleGroups, List<BiomarkerRecordDto> biomarkers,
                          List<DownloadAssetDto> downloads) {
        this.id = id;
        this.accession = accession;
        this.title = title;
        this.diseaseType = diseaseType;
        this.sampleSource = sampleSource;
        this.technology = technology;
        this.journal = journal;
        this.publicationYear = publicationYear;
        this.doi = doi;
        this.pmid = pmid;
        this.abstractText = abstractText;
        this.cohortSize = cohortSize;
        this.citation = citation;
        this.datasets = datasets;
        this.sampleGroups = sampleGroups;
        this.biomarkers = biomarkers;
        this.downloads = downloads;
    }

    public Long id() { return id; }
    public String accession() { return accession; }
    public String title() { return title; }
    public String diseaseType() { return diseaseType; }
    public String sampleSource() { return sampleSource; }
    public String technology() { return technology; }
    public String journal() { return journal; }
    public Integer publicationYear() { return publicationYear; }
    public String doi() { return doi; }
    public String pmid() { return pmid; }
    public String abstractText() { return abstractText; }
    public Integer cohortSize() { return cohortSize; }
    public String citation() { return citation; }
    public List<DatasetDto> datasets() { return datasets; }
    public List<SampleGroupDto> sampleGroups() { return sampleGroups; }
    public List<BiomarkerRecordDto> biomarkers() { return biomarkers; }
    public List<DownloadAssetDto> downloads() { return downloads; }

    public Long getId() { return id; }
    public String getAccession() { return accession; }
    public String getTitle() { return title; }
    public String getDiseaseType() { return diseaseType; }
    public String getSampleSource() { return sampleSource; }
    public String getTechnology() { return technology; }
    public String getJournal() { return journal; }
    public Integer getPublicationYear() { return publicationYear; }
    public String getDoi() { return doi; }
    public String getPmid() { return pmid; }
    public String getAbstractText() { return abstractText; }
    public Integer getCohortSize() { return cohortSize; }
    public String getCitation() { return citation; }
    public List<DatasetDto> getDatasets() { return datasets; }
    public List<SampleGroupDto> getSampleGroups() { return sampleGroups; }
    public List<BiomarkerRecordDto> getBiomarkers() { return biomarkers; }
    public List<DownloadAssetDto> getDownloads() { return downloads; }
}
