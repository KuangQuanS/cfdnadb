package org.cfdna.database.dto;

import java.util.List;

public class VafBoxStatsDto {

    private final int n;
    private final double min;
    private final double q1;
    private final double median;
    private final double q3;
    private final double max;
    private final double whiskerLow;
    private final double whiskerHigh;
    private final List<Double> points;

    public VafBoxStatsDto(int n,
                          double min,
                          double q1,
                          double median,
                          double q3,
                          double max,
                          double whiskerLow,
                          double whiskerHigh,
                          List<Double> points) {
        this.n = n;
        this.min = min;
        this.q1 = q1;
        this.median = median;
        this.q3 = q3;
        this.max = max;
        this.whiskerLow = whiskerLow;
        this.whiskerHigh = whiskerHigh;
        this.points = points;
    }

    public int getN() { return n; }
    public double getMin() { return min; }
    public double getQ1() { return q1; }
    public double getMedian() { return median; }
    public double getQ3() { return q3; }
    public double getMax() { return max; }
    public double getWhiskerLow() { return whiskerLow; }
    public double getWhiskerHigh() { return whiskerHigh; }
    public List<Double> getPoints() { return points; }
}
