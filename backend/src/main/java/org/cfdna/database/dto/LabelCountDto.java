package org.cfdna.database.dto;

public class LabelCountDto {

    private final String label;
    private final long count;

    public LabelCountDto(String label, long count) {
        this.label = label;
        this.count = count;
    }

    public String label() { return label; }
    public long count() { return count; }
    public String getLabel() { return label; }
    public long getCount() { return count; }
}
