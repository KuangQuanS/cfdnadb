package org.cfdna.database.dto;

import java.util.List;

public class VafDistributionDto {

    private final String cancerType;
    private final List<Double> values;
    private final int sampleCount;

    public VafDistributionDto(String cancerType, List<Double> values) {
        this.cancerType = cancerType;
        this.values = values;
        this.sampleCount = values.size();
    }

    public String getCancerType() { return cancerType; }
    public List<Double> getValues() { return values; }
    public int getSampleCount() { return sampleCount; }
}
