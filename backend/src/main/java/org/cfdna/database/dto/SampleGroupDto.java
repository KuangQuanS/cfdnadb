package org.cfdna.database.dto;

public class SampleGroupDto {

    private final Long id;
    private final Long datasetId;
    private final String groupName;
    private final String conditionName;
    private final String sampleType;
    private final Integer sampleCount;

    public SampleGroupDto(Long id, Long datasetId, String groupName, String conditionName, String sampleType, Integer sampleCount) {
        this.id = id;
        this.datasetId = datasetId;
        this.groupName = groupName;
        this.conditionName = conditionName;
        this.sampleType = sampleType;
        this.sampleCount = sampleCount;
    }

    public Long id() { return id; }
    public Long datasetId() { return datasetId; }
    public String groupName() { return groupName; }
    public String conditionName() { return conditionName; }
    public String sampleType() { return sampleType; }
    public Integer sampleCount() { return sampleCount; }

    public Long getId() { return id; }
    public Long getDatasetId() { return datasetId; }
    public String getGroupName() { return groupName; }
    public String getConditionName() { return conditionName; }
    public String getSampleType() { return sampleType; }
    public Integer getSampleCount() { return sampleCount; }
}
