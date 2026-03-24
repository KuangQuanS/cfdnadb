package org.cfdna.database.dto;

import java.util.List;

public class FilterOptionsDto {

    private final List<String> diseaseTypes;
    private final List<String> sampleSources;
    private final List<String> technologies;
    private final List<String> markerTypes;
    private final List<String> specimenTypes;
    private final List<Integer> publicationYears;

    public FilterOptionsDto(List<String> diseaseTypes, List<String> sampleSources, List<String> technologies,
                            List<String> markerTypes, List<String> specimenTypes, List<Integer> publicationYears) {
        this.diseaseTypes = diseaseTypes;
        this.sampleSources = sampleSources;
        this.technologies = technologies;
        this.markerTypes = markerTypes;
        this.specimenTypes = specimenTypes;
        this.publicationYears = publicationYears;
    }

    public List<String> diseaseTypes() { return diseaseTypes; }
    public List<String> sampleSources() { return sampleSources; }
    public List<String> technologies() { return technologies; }
    public List<String> markerTypes() { return markerTypes; }
    public List<String> specimenTypes() { return specimenTypes; }
    public List<Integer> publicationYears() { return publicationYears; }

    public List<String> getDiseaseTypes() { return diseaseTypes; }
    public List<String> getSampleSources() { return sampleSources; }
    public List<String> getTechnologies() { return technologies; }
    public List<String> getMarkerTypes() { return markerTypes; }
    public List<String> getSpecimenTypes() { return specimenTypes; }
    public List<Integer> getPublicationYears() { return publicationYears; }
}
