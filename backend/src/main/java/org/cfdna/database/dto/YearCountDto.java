package org.cfdna.database.dto;

public class YearCountDto {

    private final int year;
    private final long count;

    public YearCountDto(int year, long count) {
        this.year = year;
        this.count = count;
    }

    public int year() { return year; }
    public long count() { return count; }
    public int getYear() { return year; }
    public long getCount() { return count; }
}
