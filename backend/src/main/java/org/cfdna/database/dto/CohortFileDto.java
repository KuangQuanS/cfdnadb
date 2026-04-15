package org.cfdna.database.dto;

public class CohortFileDto {

    private final String cancer;
    private final String source;
    private final String category;
    private final String fileName;
    private final String displayName;
    private final String sampleId;
    private final long sizeBytes;
    private final String downloadUrl;

    public CohortFileDto(String cancer, String source, String category, String fileName,
                         String displayName, String sampleId, long sizeBytes, String downloadUrl) {
        this.cancer = cancer;
        this.source = source;
        this.category = category;
        this.fileName = fileName;
        this.displayName = displayName;
        this.sampleId = sampleId;
        this.sizeBytes = sizeBytes;
        this.downloadUrl = downloadUrl;
    }

    public String getCancer() { return cancer; }
    public String getSource() { return source; }
    public String getCategory() { return category; }
    public String getFileName() { return fileName; }
    public String getDisplayName() { return displayName; }
    public String getSampleId() { return sampleId; }
    public long getSizeBytes() { return sizeBytes; }
    public String getDownloadUrl() { return downloadUrl; }
}
