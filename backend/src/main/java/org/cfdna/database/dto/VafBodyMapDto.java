package org.cfdna.database.dto;

import java.util.List;

public class VafBodyMapDto {

    private final String gene;
    private final List<VafBodyMapEntryDto> entries;
    private final double maxMeanVaf;

    public VafBodyMapDto(String gene, List<VafBodyMapEntryDto> entries, double maxMeanVaf) {
        this.gene = gene;
        this.entries = entries;
        this.maxMeanVaf = maxMeanVaf;
    }

    public String getGene() { return gene; }
    public List<VafBodyMapEntryDto> getEntries() { return entries; }
    public double getMaxMeanVaf() { return maxMeanVaf; }
}
