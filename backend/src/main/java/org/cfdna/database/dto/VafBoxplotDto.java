package org.cfdna.database.dto;

import java.util.Map;

public class VafBoxplotDto {

    private final String title;
    private final String xLabel;
    private final String yLabel;
    private final Map<String, VafBoxStatsDto> groups;

    public VafBoxplotDto(String title,
                         String xLabel,
                         String yLabel,
                         Map<String, VafBoxStatsDto> groups) {
        this.title = title;
        this.xLabel = xLabel;
        this.yLabel = yLabel;
        this.groups = groups;
    }

    public String getTitle() { return title; }
    public String getXLabel() { return xLabel; }
    public String getYLabel() { return yLabel; }
    public Map<String, VafBoxStatsDto> getGroups() { return groups; }
}
