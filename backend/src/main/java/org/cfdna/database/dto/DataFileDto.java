package org.cfdna.database.dto;

public class DataFileDto {

    private final String cancer;
    private final String fileType;
    private final String name;
    private final String fileName;
    private final long sizeBytes;
    private final String downloadUrl;

    public DataFileDto(String cancer, String fileType, String name, String fileName, long sizeBytes, String downloadUrl) {
        this.cancer = cancer;
        this.fileType = fileType;
        this.name = name;
        this.fileName = fileName;
        this.sizeBytes = sizeBytes;
        this.downloadUrl = downloadUrl;
    }

    public String getCancer() { return cancer; }
    public String getFileType() { return fileType; }
    public String getName() { return name; }
    public String getFileName() { return fileName; }
    public long getSizeBytes() { return sizeBytes; }
    public String getDownloadUrl() { return downloadUrl; }
}
