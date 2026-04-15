package org.cfdna.database.dto;

import java.util.List;

public class SampleDetailDto {

    private final String sampleId;
    private final String cancer;
    private final String source;
    private final long variantCount;
    private final List<LabelCountDto> topGenes;
    private final List<SampleFileDto> files;

    public SampleDetailDto(String sampleId, String cancer, String source, long variantCount,
                           List<LabelCountDto> topGenes, List<SampleFileDto> files) {
        this.sampleId = sampleId;
        this.cancer = cancer;
        this.source = source;
        this.variantCount = variantCount;
        this.topGenes = topGenes;
        this.files = files;
    }

    public String sampleId() { return sampleId; }
    public String cancer() { return cancer; }
    public String source() { return source; }
    public long variantCount() { return variantCount; }
    public List<LabelCountDto> topGenes() { return topGenes; }
    public List<SampleFileDto> files() { return files; }

    public String getSampleId() { return sampleId; }
    public String getCancer() { return cancer; }
    public String getSource() { return source; }
    public long getVariantCount() { return variantCount; }
    public List<LabelCountDto> getTopGenes() { return topGenes; }
    public List<SampleFileDto> getFiles() { return files; }
}
