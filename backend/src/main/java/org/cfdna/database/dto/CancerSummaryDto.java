package org.cfdna.database.dto;

public class CancerSummaryDto {

    private final String cancer;
    private final long sampleCount;
    private final long totalDataFiles;
    private final long avinputCount;
    private final long filteredCount;
    private final long annotatedCount;
    private final long somaticCount;
    private final long plotAssetCount;
    private final long externalAssetCount;
    private final long mutationCount;
    private final String rawImportStatus;
    private final String filteredStatus;
    private final String annotatedStatus;
    private final String somaticStatus;
    private final String plotStatus;
    private final String externalStatus;

    public CancerSummaryDto(
            String cancer,
            long sampleCount,
            long totalDataFiles,
            long avinputCount,
            long filteredCount,
            long annotatedCount,
            long somaticCount,
            long plotAssetCount,
            long externalAssetCount,
            long mutationCount,
            String rawImportStatus,
            String filteredStatus,
            String annotatedStatus,
            String somaticStatus,
            String plotStatus,
            String externalStatus
    ) {
        this.cancer = cancer;
        this.sampleCount = sampleCount;
        this.totalDataFiles = totalDataFiles;
        this.avinputCount = avinputCount;
        this.filteredCount = filteredCount;
        this.annotatedCount = annotatedCount;
        this.somaticCount = somaticCount;
        this.plotAssetCount = plotAssetCount;
        this.externalAssetCount = externalAssetCount;
        this.mutationCount = mutationCount;
        this.rawImportStatus = rawImportStatus;
        this.filteredStatus = filteredStatus;
        this.annotatedStatus = annotatedStatus;
        this.somaticStatus = somaticStatus;
        this.plotStatus = plotStatus;
        this.externalStatus = externalStatus;
    }

    public String cancer() { return cancer; }
    public long sampleCount() { return sampleCount; }
    public long totalDataFiles() { return totalDataFiles; }
    public long avinputCount() { return avinputCount; }
    public long filteredCount() { return filteredCount; }
    public long annotatedCount() { return annotatedCount; }
    public long somaticCount() { return somaticCount; }
    public long plotAssetCount() { return plotAssetCount; }
    public long externalAssetCount() { return externalAssetCount; }
    public long mutationCount() { return mutationCount; }
    public String rawImportStatus() { return rawImportStatus; }
    public String filteredStatus() { return filteredStatus; }
    public String annotatedStatus() { return annotatedStatus; }
    public String somaticStatus() { return somaticStatus; }
    public String plotStatus() { return plotStatus; }
    public String externalStatus() { return externalStatus; }

    public String getCancer() { return cancer; }
    public long getSampleCount() { return sampleCount; }
    public long getTotalDataFiles() { return totalDataFiles; }
    public long getAvinputCount() { return avinputCount; }
    public long getFilteredCount() { return filteredCount; }
    public long getAnnotatedCount() { return annotatedCount; }
    public long getSomaticCount() { return somaticCount; }
    public long getPlotAssetCount() { return plotAssetCount; }
    public long getExternalAssetCount() { return externalAssetCount; }
    public long getMutationCount() { return mutationCount; }
    public String getRawImportStatus() { return rawImportStatus; }
    public String getFilteredStatus() { return filteredStatus; }
    public String getAnnotatedStatus() { return annotatedStatus; }
    public String getSomaticStatus() { return somaticStatus; }
    public String getPlotStatus() { return plotStatus; }
    public String getExternalStatus() { return externalStatus; }
}
