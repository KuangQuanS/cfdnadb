package org.cfdna.database.dto;

public class GenePlotDto {

    private final String fileName;
    private final String url;
    private final String cancer;
    private final String gene;
    private final String chromosome;
    private final String startPosition;
    private final String endPosition;

    public GenePlotDto(String fileName, String url, String cancer, String gene,
                       String chromosome, String startPosition, String endPosition) {
        this.fileName = fileName;
        this.url = url;
        this.cancer = cancer;
        this.gene = gene;
        this.chromosome = chromosome;
        this.startPosition = startPosition;
        this.endPosition = endPosition;
    }

    public String getFileName() { return fileName; }
    public String getUrl() { return url; }
    public String getCancer() { return cancer; }
    public String getGene() { return gene; }
    public String getChromosome() { return chromosome; }
    public String getStartPosition() { return startPosition; }
    public String getEndPosition() { return endPosition; }

    /** Display label, e.g. "chr8:41696698-41696698" */
    public String getCoordinateLabel() {
        if (startPosition == null || startPosition.isEmpty()) return chromosome;
        if (endPosition == null || endPosition.isEmpty() || endPosition.equals(startPosition)) {
            return chromosome + ":" + startPosition;
        }
        return chromosome + ":" + startPosition + "-" + endPosition;
    }
}
