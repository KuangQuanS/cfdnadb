package org.cfdna.database.dto;

public class MafMutationDto {

    private final long id;
    private final String hugoSymbol;
    private final String cancerType;
    private final String chromosome;
    private final String startPosition;
    private final String endPosition;
    private final String referenceAllele;
    private final String tumorSeqAllele2;
    private final String variantClassification;
    private final String variantType;
    private final String tumorSampleBarcode;

    public MafMutationDto(long id, String hugoSymbol, String cancerType, String chromosome,
                          String startPosition, String endPosition,
                          String referenceAllele, String tumorSeqAllele2,
                          String variantClassification, String variantType,
                          String tumorSampleBarcode) {
        this.id = id;
        this.hugoSymbol = hugoSymbol;
        this.cancerType = cancerType;
        this.chromosome = chromosome;
        this.startPosition = startPosition;
        this.endPosition = endPosition;
        this.referenceAllele = referenceAllele;
        this.tumorSeqAllele2 = tumorSeqAllele2;
        this.variantClassification = variantClassification;
        this.variantType = variantType;
        this.tumorSampleBarcode = tumorSampleBarcode;
    }

    public long getId() { return id; }
    public String getHugoSymbol() { return hugoSymbol; }
    public String getCancerType() { return cancerType; }
    public String getChromosome() { return chromosome; }
    public String getStartPosition() { return startPosition; }
    public String getEndPosition() { return endPosition; }
    public String getReferenceAllele() { return referenceAllele; }
    public String getTumorSeqAllele2() { return tumorSeqAllele2; }
    public String getVariantClassification() { return variantClassification; }
    public String getVariantType() { return variantType; }
    public String getTumorSampleBarcode() { return tumorSampleBarcode; }
}
