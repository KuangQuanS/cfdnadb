package org.cfdna.database.dto;

import java.util.List;

public class VafBodyMapDto {

    private final String gene;
    private final List<VafBodyMapEntryDto> entries;
    private final double maxMeanVaf;
    private final VafBoxplotDto cancerTypeBoxplot;
    private final VafBoxplotDto mutationTypeBoxplot;

    public VafBodyMapDto(String gene, List<VafBodyMapEntryDto> entries, double maxMeanVaf) {
        this(gene, entries, maxMeanVaf, null, null);
    }

    public VafBodyMapDto(String gene,
                         List<VafBodyMapEntryDto> entries,
                         double maxMeanVaf,
                         VafBoxplotDto cancerTypeBoxplot,
                         VafBoxplotDto mutationTypeBoxplot) {
        this.gene = gene;
        this.entries = entries;
        this.maxMeanVaf = maxMeanVaf;
        this.cancerTypeBoxplot = cancerTypeBoxplot;
        this.mutationTypeBoxplot = mutationTypeBoxplot;
    }

    public String getGene() { return gene; }
    public List<VafBodyMapEntryDto> getEntries() { return entries; }
    public double getMaxMeanVaf() { return maxMeanVaf; }
    public VafBoxplotDto getCancerTypeBoxplot() { return cancerTypeBoxplot; }
    public VafBoxplotDto getMutationTypeBoxplot() { return mutationTypeBoxplot; }
}
