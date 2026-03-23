package org.cfdna.database.repository;

import org.cfdna.database.domain.SampleGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SampleGroupRepository extends JpaRepository<SampleGroup, Long> {

    List<SampleGroup> findByDatasetStudyIdOrderByDatasetIdAscIdAsc(Long studyId);
}
