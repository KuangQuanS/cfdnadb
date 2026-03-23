package org.cfdna.database.service;

import org.cfdna.database.dto.PagedResponse;
import org.cfdna.database.dto.StudyDetailDto;
import org.cfdna.database.dto.StudyQueryRequest;
import org.cfdna.database.dto.StudySummaryDto;

public interface StudyService {

    PagedResponse<StudySummaryDto> listStudies(StudyQueryRequest request);

    StudyDetailDto getStudy(Long id);
}
