package org.cfdna.database.dto;

import java.util.List;

public class MafFilterOptionsDto {

    private final String source;
    private final List<String> cancerTypes;
    private final List<String> chromosomes;
    private final List<String> variantClassifications;
    private final List<String> variantTypes;

    public MafFilterOptionsDto(String source, List<String> cancerTypes, List<String> chromosomes,
                               List<String> variantClassifications, List<String> variantTypes) {
        this.source = source;
        this.cancerTypes = cancerTypes;
        this.chromosomes = chromosomes;
        this.variantClassifications = variantClassifications;
        this.variantTypes = variantTypes;
    }

    public String getSource() { return source; }
    public List<String> getCancerTypes() { return cancerTypes; }
    public List<String> getChromosomes() { return chromosomes; }
    public List<String> getVariantClassifications() { return variantClassifications; }
    public List<String> getVariantTypes() { return variantTypes; }
}
