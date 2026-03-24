package org.cfdna.database.dto;

public class DownloadAssetDto {

    private final Long id;
    private final String name;
    private final String category;
    private final String description;
    private final String fileName;
    private final String contentType;
    private final Long fileSizeBytes;
    private final boolean publicAsset;
    private final Long studyId;
    private final String studyAccession;
    private final String downloadUrl;

    public DownloadAssetDto(Long id, String name, String category, String description, String fileName, String contentType, Long fileSizeBytes,
                            boolean publicAsset, Long studyId, String studyAccession, String downloadUrl) {
        this.id = id;
        this.name = name;
        this.category = category;
        this.description = description;
        this.fileName = fileName;
        this.contentType = contentType;
        this.fileSizeBytes = fileSizeBytes;
        this.publicAsset = publicAsset;
        this.studyId = studyId;
        this.studyAccession = studyAccession;
        this.downloadUrl = downloadUrl;
    }

    public Long id() { return id; }
    public String name() { return name; }
    public String category() { return category; }
    public String description() { return description; }
    public String fileName() { return fileName; }
    public String contentType() { return contentType; }
    public Long fileSizeBytes() { return fileSizeBytes; }
    public boolean publicAsset() { return publicAsset; }
    public Long studyId() { return studyId; }
    public String studyAccession() { return studyAccession; }
    public String downloadUrl() { return downloadUrl; }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getCategory() { return category; }
    public String getDescription() { return description; }
    public String getFileName() { return fileName; }
    public String getContentType() { return contentType; }
    public Long getFileSizeBytes() { return fileSizeBytes; }
    public boolean isPublicAsset() { return publicAsset; }
    public Long getStudyId() { return studyId; }
    public String getStudyAccession() { return studyAccession; }
    public String getDownloadUrl() { return downloadUrl; }
}
