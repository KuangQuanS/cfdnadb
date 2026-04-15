package org.cfdna.database.dto;

public class SampleFileDto {

    private final String type;
    private final String fileName;
    private final long sizeBytes;
    private final String lastModified;
    private final String downloadUrl;

    public SampleFileDto(String type, String fileName, long sizeBytes, String lastModified, String downloadUrl) {
        this.type = type;
        this.fileName = fileName;
        this.sizeBytes = sizeBytes;
        this.lastModified = lastModified;
        this.downloadUrl = downloadUrl;
    }

    public String type() { return type; }
    public String fileName() { return fileName; }
    public long sizeBytes() { return sizeBytes; }
    public String lastModified() { return lastModified; }
    public String downloadUrl() { return downloadUrl; }

    public String getType() { return type; }
    public String getFileName() { return fileName; }
    public long getSizeBytes() { return sizeBytes; }
    public String getLastModified() { return lastModified; }
    public String getDownloadUrl() { return downloadUrl; }
}
