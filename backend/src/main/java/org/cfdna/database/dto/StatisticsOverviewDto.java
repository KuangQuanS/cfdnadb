package org.cfdna.database.dto;

import java.util.List;

public class StatisticsOverviewDto {

    private final String source;
    private final String generatedAt;
    private final List<CancerSummaryDto> cancerSummary;
    private final MafSummaryDto mafSummary;
    private final List<LabelCountDto> funcDistribution;
    private final List<LabelCountDto> exonicDistribution;
    private final List<LabelCountDto> chromDistribution;
    private final List<TopGeneDto> topGenes;

    public StatisticsOverviewDto(String source,
                                 String generatedAt,
                                 List<CancerSummaryDto> cancerSummary,
                                 MafSummaryDto mafSummary,
                                 List<LabelCountDto> funcDistribution,
                                 List<LabelCountDto> exonicDistribution,
                                 List<LabelCountDto> chromDistribution,
                                 List<TopGeneDto> topGenes) {
        this.source = source;
        this.generatedAt = generatedAt;
        this.cancerSummary = cancerSummary;
        this.mafSummary = mafSummary;
        this.funcDistribution = funcDistribution;
        this.exonicDistribution = exonicDistribution;
        this.chromDistribution = chromDistribution;
        this.topGenes = topGenes;
    }

    public String getSource() {
        return source;
    }

    public String getGeneratedAt() {
        return generatedAt;
    }

    public List<CancerSummaryDto> getCancerSummary() {
        return cancerSummary;
    }

    public MafSummaryDto getMafSummary() {
        return mafSummary;
    }

    public List<LabelCountDto> getFuncDistribution() {
        return funcDistribution;
    }

    public List<LabelCountDto> getExonicDistribution() {
        return exonicDistribution;
    }

    public List<LabelCountDto> getChromDistribution() {
        return chromDistribution;
    }

    public List<TopGeneDto> getTopGenes() {
        return topGenes;
    }
}
