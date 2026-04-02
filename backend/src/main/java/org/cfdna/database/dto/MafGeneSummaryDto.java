package org.cfdna.database.dto;

public class MafGeneSummaryDto {

    private final String hugoSymbol;
    private final long totalVariants;
    private final long totalSamples;
    private final long totalCoordinates;
    private final String cancerTypesPreview;
    private final String sampleBarcodesPreview;
    private final String coordinatePreview;
    private final String allelesPreview;
    private final String variantClassesPreview;
    private final String variantTypesPreview;
    private final String annotationPreview;

    public MafGeneSummaryDto(String hugoSymbol,
                             long totalVariants,
                             long totalSamples,
                             long totalCoordinates,
                             String cancerTypesPreview,
                             String sampleBarcodesPreview,
                             String coordinatePreview,
                             String allelesPreview,
                             String variantClassesPreview,
                             String variantTypesPreview,
                             String annotationPreview) {
        this.hugoSymbol = hugoSymbol;
        this.totalVariants = totalVariants;
        this.totalSamples = totalSamples;
        this.totalCoordinates = totalCoordinates;
        this.cancerTypesPreview = cancerTypesPreview;
        this.sampleBarcodesPreview = sampleBarcodesPreview;
        this.coordinatePreview = coordinatePreview;
        this.allelesPreview = allelesPreview;
        this.variantClassesPreview = variantClassesPreview;
        this.variantTypesPreview = variantTypesPreview;
        this.annotationPreview = annotationPreview;
    }

    public String getHugoSymbol() { return hugoSymbol; }
    public long getTotalVariants() { return totalVariants; }
    public long getTotalSamples() { return totalSamples; }
    public long getTotalCoordinates() { return totalCoordinates; }
    public String getCancerTypesPreview() { return cancerTypesPreview; }
    public String getSampleBarcodesPreview() { return sampleBarcodesPreview; }
    public String getCoordinatePreview() { return coordinatePreview; }
    public String getAllelesPreview() { return allelesPreview; }
    public String getVariantClassesPreview() { return variantClassesPreview; }
    public String getVariantTypesPreview() { return variantTypesPreview; }
    public String getAnnotationPreview() { return annotationPreview; }
}
