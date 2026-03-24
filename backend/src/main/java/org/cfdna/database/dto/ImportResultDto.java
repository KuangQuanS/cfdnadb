package org.cfdna.database.dto;

import java.util.List;

public class ImportResultDto {

    private final int importedStudies;
    private final List<String> importedAccessions;

    public ImportResultDto(int importedStudies, List<String> importedAccessions) {
        this.importedStudies = importedStudies;
        this.importedAccessions = importedAccessions;
    }

    public int importedStudies() { return importedStudies; }
    public List<String> importedAccessions() { return importedAccessions; }
    public int getImportedStudies() { return importedStudies; }
    public List<String> getImportedAccessions() { return importedAccessions; }
}
