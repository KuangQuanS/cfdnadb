package org.cfdna.database.dto;

import java.util.List;

public class SampleDownloadRequestDto {

    private String fileType;
    private List<SampleSelectionDto> samples;

    public String getFileType() {
        return fileType;
    }

    public void setFileType(String fileType) {
        this.fileType = fileType;
    }

    public List<SampleSelectionDto> getSamples() {
        return samples;
    }

    public void setSamples(List<SampleSelectionDto> samples) {
        this.samples = samples;
    }
}
