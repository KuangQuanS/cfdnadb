package org.cfdna.database.dto;

public class HomeBodyCalloutDto {

    private final String id;
    private final String label;
    private final String side;
    private final double labelTopPct;
    private final double labelXPct;
    private final double pointXPct;
    private final double pointYPct;
    private final String browseKey;
    private final boolean showConnector;
    private final long count;

    public HomeBodyCalloutDto(String id,
                              String label,
                              String side,
                              double labelTopPct,
                              double labelXPct,
                              double pointXPct,
                              double pointYPct,
                              String browseKey,
                              boolean showConnector,
                              long count) {
        this.id = id;
        this.label = label;
        this.side = side;
        this.labelTopPct = labelTopPct;
        this.labelXPct = labelXPct;
        this.pointXPct = pointXPct;
        this.pointYPct = pointYPct;
        this.browseKey = browseKey;
        this.showConnector = showConnector;
        this.count = count;
    }

    public String getId() { return id; }
    public String getLabel() { return label; }
    public String getSide() { return side; }
    public double getLabelTopPct() { return labelTopPct; }
    public double getLabelXPct() { return labelXPct; }
    public double getPointXPct() { return pointXPct; }
    public double getPointYPct() { return pointYPct; }
    public String getBrowseKey() { return browseKey; }
    public boolean isShowConnector() { return showConnector; }
    public long getCount() { return count; }
}
