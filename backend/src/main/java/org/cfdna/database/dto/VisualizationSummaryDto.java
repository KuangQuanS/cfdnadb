package org.cfdna.database.dto;

import java.util.List;

public class VisualizationSummaryDto {

    private final List<LabelCountDto> diseaseDistribution;
    private final List<LabelCountDto> technologyDistribution;
    private final List<LabelCountDto> markerTypeDistribution;
    private final List<LabelCountDto> sampleSourceDistribution;
    private final List<YearCountDto> publicationTrend;

    public VisualizationSummaryDto(List<LabelCountDto> diseaseDistribution, List<LabelCountDto> technologyDistribution,
                                   List<LabelCountDto> markerTypeDistribution, List<LabelCountDto> sampleSourceDistribution,
                                   List<YearCountDto> publicationTrend) {
        this.diseaseDistribution = diseaseDistribution;
        this.technologyDistribution = technologyDistribution;
        this.markerTypeDistribution = markerTypeDistribution;
        this.sampleSourceDistribution = sampleSourceDistribution;
        this.publicationTrend = publicationTrend;
    }

    public List<LabelCountDto> diseaseDistribution() { return diseaseDistribution; }
    public List<LabelCountDto> technologyDistribution() { return technologyDistribution; }
    public List<LabelCountDto> markerTypeDistribution() { return markerTypeDistribution; }
    public List<LabelCountDto> sampleSourceDistribution() { return sampleSourceDistribution; }
    public List<YearCountDto> publicationTrend() { return publicationTrend; }

    public List<LabelCountDto> getDiseaseDistribution() { return diseaseDistribution; }
    public List<LabelCountDto> getTechnologyDistribution() { return technologyDistribution; }
    public List<LabelCountDto> getMarkerTypeDistribution() { return markerTypeDistribution; }
    public List<LabelCountDto> getSampleSourceDistribution() { return sampleSourceDistribution; }
    public List<YearCountDto> getPublicationTrend() { return publicationTrend; }
}
