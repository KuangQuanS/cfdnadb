package org.cfdna.database.dto;

public class DatabaseStatsDto {

    private final long totalVariants;
    private final long totalSamples;
    private final long totalGenes;
    private final int cohortCount;

    public DatabaseStatsDto(long totalVariants, long totalSamples, long totalGenes, int cohortCount) {
        this.totalVariants = totalVariants;
        this.totalSamples = totalSamples;
        this.totalGenes = totalGenes;
        this.cohortCount = cohortCount;
    }

    public long getTotalVariants() { return totalVariants; }
    public long getTotalSamples() { return totalSamples; }
    public long getTotalGenes() { return totalGenes; }
    public int getCohortCount() { return cohortCount; }
}
