package org.cfdna.database.dto;

import java.math.BigDecimal;

public class BiomarkerRecordDto {

    private final Long id;
    private final String markerName;
    private final String markerType;
    private final String chromosomeLocation;
    private final String regulationDirection;
    private final String assayPlatform;
    private final String specimenType;
    private final String diseaseType;
    private final String significanceMetric;
    private final BigDecimal significanceValue;
    private final BigDecimal effectSize;
    private final String notes;
    private final Long studyId;
    private final String studyAccession;
    private final String studyTitle;
    private final Integer publicationYear;

    public BiomarkerRecordDto(Long id, String markerName, String markerType, String chromosomeLocation, String regulationDirection,
                              String assayPlatform, String specimenType, String diseaseType, String significanceMetric,
                              BigDecimal significanceValue, BigDecimal effectSize, String notes, Long studyId,
                              String studyAccession, String studyTitle, Integer publicationYear) {
        this.id = id;
        this.markerName = markerName;
        this.markerType = markerType;
        this.chromosomeLocation = chromosomeLocation;
        this.regulationDirection = regulationDirection;
        this.assayPlatform = assayPlatform;
        this.specimenType = specimenType;
        this.diseaseType = diseaseType;
        this.significanceMetric = significanceMetric;
        this.significanceValue = significanceValue;
        this.effectSize = effectSize;
        this.notes = notes;
        this.studyId = studyId;
        this.studyAccession = studyAccession;
        this.studyTitle = studyTitle;
        this.publicationYear = publicationYear;
    }

    public Long id() { return id; }
    public String markerName() { return markerName; }
    public String markerType() { return markerType; }
    public String chromosomeLocation() { return chromosomeLocation; }
    public String regulationDirection() { return regulationDirection; }
    public String assayPlatform() { return assayPlatform; }
    public String specimenType() { return specimenType; }
    public String diseaseType() { return diseaseType; }
    public String significanceMetric() { return significanceMetric; }
    public BigDecimal significanceValue() { return significanceValue; }
    public BigDecimal effectSize() { return effectSize; }
    public String notes() { return notes; }
    public Long studyId() { return studyId; }
    public String studyAccession() { return studyAccession; }
    public String studyTitle() { return studyTitle; }
    public Integer publicationYear() { return publicationYear; }

    public Long getId() { return id; }
    public String getMarkerName() { return markerName; }
    public String getMarkerType() { return markerType; }
    public String getChromosomeLocation() { return chromosomeLocation; }
    public String getRegulationDirection() { return regulationDirection; }
    public String getAssayPlatform() { return assayPlatform; }
    public String getSpecimenType() { return specimenType; }
    public String getDiseaseType() { return diseaseType; }
    public String getSignificanceMetric() { return significanceMetric; }
    public BigDecimal getSignificanceValue() { return significanceValue; }
    public BigDecimal getEffectSize() { return effectSize; }
    public String getNotes() { return notes; }
    public Long getStudyId() { return studyId; }
    public String getStudyAccession() { return studyAccession; }
    public String getStudyTitle() { return studyTitle; }
    public Integer getPublicationYear() { return publicationYear; }
}
