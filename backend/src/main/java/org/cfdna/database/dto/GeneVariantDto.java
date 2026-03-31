package org.cfdna.database.dto;

public class GeneVariantDto {

    private final String chr;
    private final String start;
    private final String end;
    private final String ref;
    private final String alt;
    private final String func;
    private final String exonicFunc;
    private final String gene;
    private final String aaChange;
    private final String sample;

    public GeneVariantDto(String chr, String start, String end, String ref, String alt,
                          String func, String exonicFunc, String gene, String aaChange, String sample) {
        this.chr = chr;
        this.start = start;
        this.end = end;
        this.ref = ref;
        this.alt = alt;
        this.func = func;
        this.exonicFunc = exonicFunc;
        this.gene = gene;
        this.aaChange = aaChange;
        this.sample = sample;
    }

    public String chr() { return chr; }
    public String start() { return start; }
    public String end() { return end; }
    public String ref() { return ref; }
    public String alt() { return alt; }
    public String func() { return func; }
    public String exonicFunc() { return exonicFunc; }
    public String gene() { return gene; }
    public String aaChange() { return aaChange; }
    public String sample() { return sample; }

    public String getChr() { return chr; }
    public String getStart() { return start; }
    public String getEnd() { return end; }
    public String getRef() { return ref; }
    public String getAlt() { return alt; }
    public String getFunc() { return func; }
    public String getExonicFunc() { return exonicFunc; }
    public String getGene() { return gene; }
    public String getAaChange() { return aaChange; }
    public String getSample() { return sample; }
}
