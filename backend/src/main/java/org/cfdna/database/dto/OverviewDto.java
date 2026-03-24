package org.cfdna.database.dto;

import java.util.List;

public class OverviewDto {

    private final long studyCount;
    private final long biomarkerCount;
    private final long datasetCount;
    private final long downloadableAssets;
    private final List<LabelCountDto> leadingDiseases;
    private final List<LabelCountDto> leadingTechnologies;

    public OverviewDto(long studyCount, long biomarkerCount, long datasetCount, long downloadableAssets,
                       List<LabelCountDto> leadingDiseases, List<LabelCountDto> leadingTechnologies) {
        this.studyCount = studyCount;
        this.biomarkerCount = biomarkerCount;
        this.datasetCount = datasetCount;
        this.downloadableAssets = downloadableAssets;
        this.leadingDiseases = leadingDiseases;
        this.leadingTechnologies = leadingTechnologies;
    }

    public long studyCount() { return studyCount; }
    public long biomarkerCount() { return biomarkerCount; }
    public long datasetCount() { return datasetCount; }
    public long downloadableAssets() { return downloadableAssets; }
    public List<LabelCountDto> leadingDiseases() { return leadingDiseases; }
    public List<LabelCountDto> leadingTechnologies() { return leadingTechnologies; }

    public long getStudyCount() { return studyCount; }
    public long getBiomarkerCount() { return biomarkerCount; }
    public long getDatasetCount() { return datasetCount; }
    public long getDownloadableAssets() { return downloadableAssets; }
    public List<LabelCountDto> getLeadingDiseases() { return leadingDiseases; }
    public List<LabelCountDto> getLeadingTechnologies() { return leadingTechnologies; }
}
