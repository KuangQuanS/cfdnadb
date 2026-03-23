package org.cfdna.database.service;

import org.cfdna.database.dto.BiomarkerRecordDto;
import org.cfdna.database.dto.PagedResponse;
import org.cfdna.database.dto.RecordSearchRequest;

public interface RecordService {

    PagedResponse<BiomarkerRecordDto> searchRecords(RecordSearchRequest request);
}
