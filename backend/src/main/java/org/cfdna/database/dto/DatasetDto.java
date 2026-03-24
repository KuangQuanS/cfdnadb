package org.cfdna.database.dto;

public class DatasetDto {

    private final Long id;
    private final String name;
    private final String description;
    private final String dataType;
    private final Integer recordCount;
    private final String fileFormat;
    private final String releaseVersion;

    public DatasetDto(Long id, String name, String description, String dataType, Integer recordCount, String fileFormat, String releaseVersion) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.dataType = dataType;
        this.recordCount = recordCount;
        this.fileFormat = fileFormat;
        this.releaseVersion = releaseVersion;
    }

    public Long id() { return id; }
    public String name() { return name; }
    public String description() { return description; }
    public String dataType() { return dataType; }
    public Integer recordCount() { return recordCount; }
    public String fileFormat() { return fileFormat; }
    public String releaseVersion() { return releaseVersion; }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public String getDataType() { return dataType; }
    public Integer getRecordCount() { return recordCount; }
    public String getFileFormat() { return fileFormat; }
    public String getReleaseVersion() { return releaseVersion; }
}
