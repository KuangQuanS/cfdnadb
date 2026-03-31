package org.cfdna.database.dto;

import java.util.List;

public class GeneSummaryDto {

    private final String gene;
    private final String cancer;
    private final long totalVariants;
    private final long uniqueSamples;
    private final List<LabelCountDto> funcBreakdown;
    private final List<LabelCountDto> exonicBreakdown;
    private final List<LabelCountDto> chromBreakdown;

    public GeneSummaryDto(String gene, String cancer, long totalVariants, long uniqueSamples,
                          List<LabelCountDto> funcBreakdown, List<LabelCountDto> exonicBreakdown,
                          List<LabelCountDto> chromBreakdown) {
        this.gene = gene;
        this.cancer = cancer;
        this.totalVariants = totalVariants;
        this.uniqueSamples = uniqueSamples;
        this.funcBreakdown = funcBreakdown;
        this.exonicBreakdown = exonicBreakdown;
        this.chromBreakdown = chromBreakdown;
    }

    public String getGene() { return gene; }
    public String getCancer() { return cancer; }
    public long getTotalVariants() { return totalVariants; }
    public long getUniqueSamples() { return uniqueSamples; }
    public List<LabelCountDto> getFuncBreakdown() { return funcBreakdown; }
    public List<LabelCountDto> getExonicBreakdown() { return exonicBreakdown; }
    public List<LabelCountDto> getChromBreakdown() { return chromBreakdown; }
}
