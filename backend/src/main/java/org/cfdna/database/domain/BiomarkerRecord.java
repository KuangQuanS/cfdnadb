package org.cfdna.database.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;

@Entity
@Table(name = "biomarker_records")
public class BiomarkerRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "study_id")
    private Study study;

    @Column(nullable = false, length = 255)
    private String markerName;

    @Column(nullable = false, length = 120)
    private String markerType;

    @Column(length = 120)
    private String chromosomeLocation;

    @Column(length = 64)
    private String regulationDirection;

    @Column(length = 120)
    private String assayPlatform;

    @Column(length = 120)
    private String specimenType;

    @Column(length = 120)
    private String diseaseType;

    @Column(length = 120)
    private String significanceMetric;

    @Column(precision = 12, scale = 4)
    private BigDecimal significanceValue;

    @Column(precision = 12, scale = 4)
    private BigDecimal effectSize;

    @Column(length = 1000)
    private String notes;

    public Long getId() {
        return id;
    }

    public Study getStudy() {
        return study;
    }

    public void setStudy(Study study) {
        this.study = study;
    }

    public String getMarkerName() {
        return markerName;
    }

    public void setMarkerName(String markerName) {
        this.markerName = markerName;
    }

    public String getMarkerType() {
        return markerType;
    }

    public void setMarkerType(String markerType) {
        this.markerType = markerType;
    }

    public String getChromosomeLocation() {
        return chromosomeLocation;
    }

    public void setChromosomeLocation(String chromosomeLocation) {
        this.chromosomeLocation = chromosomeLocation;
    }

    public String getRegulationDirection() {
        return regulationDirection;
    }

    public void setRegulationDirection(String regulationDirection) {
        this.regulationDirection = regulationDirection;
    }

    public String getAssayPlatform() {
        return assayPlatform;
    }

    public void setAssayPlatform(String assayPlatform) {
        this.assayPlatform = assayPlatform;
    }

    public String getSpecimenType() {
        return specimenType;
    }

    public void setSpecimenType(String specimenType) {
        this.specimenType = specimenType;
    }

    public String getDiseaseType() {
        return diseaseType;
    }

    public void setDiseaseType(String diseaseType) {
        this.diseaseType = diseaseType;
    }

    public String getSignificanceMetric() {
        return significanceMetric;
    }

    public void setSignificanceMetric(String significanceMetric) {
        this.significanceMetric = significanceMetric;
    }

    public BigDecimal getSignificanceValue() {
        return significanceValue;
    }

    public void setSignificanceValue(BigDecimal significanceValue) {
        this.significanceValue = significanceValue;
    }

    public BigDecimal getEffectSize() {
        return effectSize;
    }

    public void setEffectSize(BigDecimal effectSize) {
        this.effectSize = effectSize;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }
}

