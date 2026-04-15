package org.cfdna.database.dto;

import java.util.List;

public class SampleBrowseItemDto {

    private final String sampleId;
    private final String cancer;
    private final String source;
    private final long variantCount;
    private final List<String> topGenes;
    private final List<String> availableFiles;
    private final boolean hasAnnotated;
    private final boolean hasSomatic;

    public SampleBrowseItemDto(String sampleId, String cancer, String source, long variantCount,
                               List<String> topGenes, List<String> availableFiles,
                               boolean hasAnnotated, boolean hasSomatic) {
        this.sampleId = sampleId;
        this.cancer = cancer;
        this.source = source;
        this.variantCount = variantCount;
        this.topGenes = topGenes;
        this.availableFiles = availableFiles;
        this.hasAnnotated = hasAnnotated;
        this.hasSomatic = hasSomatic;
    }

    public String sampleId() { return sampleId; }
    public String cancer() { return cancer; }
    public String source() { return source; }
    public long variantCount() { return variantCount; }
    public List<String> topGenes() { return topGenes; }
    public List<String> availableFiles() { return availableFiles; }
    public boolean hasAnnotated() { return hasAnnotated; }
    public boolean hasSomatic() { return hasSomatic; }

    public String getSampleId() { return sampleId; }
    public String getCancer() { return cancer; }
    public String getSource() { return source; }
    public long getVariantCount() { return variantCount; }
    public List<String> getTopGenes() { return topGenes; }
    public List<String> getAvailableFiles() { return availableFiles; }
    public boolean isHasAnnotated() { return hasAnnotated; }
    public boolean isHasSomatic() { return hasSomatic; }
}
