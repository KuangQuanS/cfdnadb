package org.cfdna.database.dto;

public class VafBodyMapEntryDto {

    private final String cohort;
    private final String cancerType;
    private final String organKey;
    private final double meanVaf;
    private final double medianVaf;
    private final double minVaf;
    private final double maxVaf;
    private final int recordCount;
    private final int sampleCount;

    public VafBodyMapEntryDto(String cohort,
                              String cancerType,
                              String organKey,
                              double meanVaf,
                              double medianVaf,
                              double minVaf,
                              double maxVaf,
                              int recordCount,
                              int sampleCount) {
        this.cohort = cohort;
        this.cancerType = cancerType;
        this.organKey = organKey;
        this.meanVaf = meanVaf;
        this.medianVaf = medianVaf;
        this.minVaf = minVaf;
        this.maxVaf = maxVaf;
        this.recordCount = recordCount;
        this.sampleCount = sampleCount;
    }

    public String getCohort() { return cohort; }
    public String getCancerType() { return cancerType; }
    public String getOrganKey() { return organKey; }
    public double getMeanVaf() { return meanVaf; }
    public double getMedianVaf() { return medianVaf; }
    public double getMinVaf() { return minVaf; }
    public double getMaxVaf() { return maxVaf; }
    public int getRecordCount() { return recordCount; }
    public int getSampleCount() { return sampleCount; }
}
