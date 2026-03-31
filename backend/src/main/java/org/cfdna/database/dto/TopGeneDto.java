package org.cfdna.database.dto;

public class TopGeneDto {

    private final String gene;
    private final long count;

    public TopGeneDto(String gene, long count) {
        this.gene = gene;
        this.count = count;
    }

    public String gene() { return gene; }
    public long count() { return count; }

    public String getGene() { return gene; }
    public long getCount() { return count; }
}
