package org.cfdna.database.dto;

public class CancerAssetDto {

    private final String category;
    private final String title;
    private final String fileName;
    private final long sizeBytes;
    private final String assetUrl;

    public CancerAssetDto(String category, String title, String fileName, long sizeBytes, String assetUrl) {
        this.category = category;
        this.title = title;
        this.fileName = fileName;
        this.sizeBytes = sizeBytes;
        this.assetUrl = assetUrl;
    }

    public String category() { return category; }
    public String title() { return title; }
    public String fileName() { return fileName; }
    public long sizeBytes() { return sizeBytes; }
    public String assetUrl() { return assetUrl; }

    public String getCategory() { return category; }
    public String getTitle() { return title; }
    public String getFileName() { return fileName; }
    public long getSizeBytes() { return sizeBytes; }
    public String getAssetUrl() { return assetUrl; }
}
