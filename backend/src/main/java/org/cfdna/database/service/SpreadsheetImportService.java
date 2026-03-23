package org.cfdna.database.service;

import org.cfdna.database.dto.ImportResultDto;

import java.io.IOException;
import java.io.InputStream;

public interface SpreadsheetImportService {

    ImportResultDto importStudiesCsv(InputStream inputStream) throws IOException;
}
