package org.cfdna.database.dto;

public class StudySummaryDto {

    private final Long id;
    private final String accession;
    private final String title;
    private final String diseaseType;
    private final String sampleSource;
    private final String technology;
    private final String journal;
    private final Integer publicationYear;
    private final Integer cohortSize;
    private final long biomarkerCount;
    private final long datasetCount;

    public StudySummaryDto(Long id, String accession, String title, String diseaseType, String sampleSource,
                           String technology, String journal, Integer publicationYear, Integer cohortSize,
                           long biomarkerCount, long datasetCount) {
        this.id = id;
        this.accession = accession;
        this.title = title;
        this.diseaseType = diseaseType;
        this.sampleSource = sampleSource;
        this.technology = technology;
        this.journal = journal;
        this.publicationYear = publicationYear;
        this.cohortSize = cohortSize;
        this.biomarkerCount = biomarkerCount;
        this.datasetCount = datasetCount;
    }

    public Long id() { return id; }
    public String accession() { return accession; }
    public String title() { return title; }
    public String diseaseType() { return diseaseType; }
    public String sampleSource() { return sampleSource; }
    public String technology() { return technology; }
    public String journal() { return journal; }
    public Integer publicationYear() { return publicationYear; }
    public Integer cohortSize() { return cohortSize; }
    public long biomarkerCount() { return biomarkerCount; }
    public long datasetCount() { return datasetCount; }

    public Long getId() { return id; }
    public String getAccession() { return accession; }
    public String getTitle() { return title; }
    public String getDiseaseType() { return diseaseType; }
    public String getSampleSource() { return sampleSource; }
    public String getTechnology() { return technology; }
    public String getJournal() { return journal; }
    public Integer getPublicationYear() { return publicationYear; }
    public Integer getCohortSize() { return cohortSize; }
    public long getBiomarkerCount() { return biomarkerCount; }
    public long getDatasetCount() { return datasetCount; }
}
