package org.cfdna.database.dto;

import java.util.List;
import java.util.Map;

public class OncoplottDto {

    private final List<String> genes;
    private final List<String> samples;
    private final List<CellDto> cells;
    private final Map<String, Long> geneCounts;
    private final Map<String, Long> sampleCounts;

    public OncoplottDto(List<String> genes, List<String> samples, List<CellDto> cells,
                        Map<String, Long> geneCounts, Map<String, Long> sampleCounts) {
        this.genes = genes;
        this.samples = samples;
        this.cells = cells;
        this.geneCounts = geneCounts;
        this.sampleCounts = sampleCounts;
    }

    public List<String> getGenes() { return genes; }
    public List<String> getSamples() { return samples; }
    public List<CellDto> getCells() { return cells; }
    public Map<String, Long> getGeneCounts() { return geneCounts; }
    public Map<String, Long> getSampleCounts() { return sampleCounts; }

    public static class CellDto {
        private final String gene;
        private final String sample;
        private final String variantClass;

        public CellDto(String gene, String sample, String variantClass) {
            this.gene = gene;
            this.sample = sample;
            this.variantClass = variantClass;
        }

        public String getGene() { return gene; }
        public String getSample() { return sample; }
        public String getVariantClass() { return variantClass; }
    }
}
