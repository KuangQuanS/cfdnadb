package org.cfdna.database.dto;

import java.util.List;

public class GeneDescriptionDto {

    private final String symbol;
    private final String geneId;
    private final String name;
    private final String summary;
    private final List<String> aliases;
    private final String ncbiUrl;

    public GeneDescriptionDto(String symbol, String geneId, String name, String summary,
                              List<String> aliases, String ncbiUrl) {
        this.symbol = symbol;
        this.geneId = geneId;
        this.name = name;
        this.summary = summary;
        this.aliases = aliases;
        this.ncbiUrl = ncbiUrl;
    }

    public String symbol() { return symbol; }
    public String geneId() { return geneId; }
    public String name() { return name; }
    public String summary() { return summary; }
    public List<String> aliases() { return aliases; }
    public String ncbiUrl() { return ncbiUrl; }

    public String getSymbol() { return symbol; }
    public String getGeneId() { return geneId; }
    public String getName() { return name; }
    public String getSummary() { return summary; }
    public List<String> getAliases() { return aliases; }
    public String getNcbiUrl() { return ncbiUrl; }
}
