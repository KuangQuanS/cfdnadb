package org.cfdna.database.dto;

public class MafSummaryDto {

    private final String source;
    private final long totalVariants;
    private final long totalSamples;
    private final long totalGenes;

    public MafSummaryDto(String source, long totalVariants, long totalSamples, long totalGenes) {
        this.source = source;
        this.totalVariants = totalVariants;
        this.totalSamples = totalSamples;
        this.totalGenes = totalGenes;
    }

    public String getSource() { return source; }
    public long getTotalVariants() { return totalVariants; }
    public long getTotalSamples() { return totalSamples; }
    public long getTotalGenes() { return totalGenes; }
}
