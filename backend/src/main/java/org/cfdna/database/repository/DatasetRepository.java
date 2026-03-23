package org.cfdna.database.repository;

import org.cfdna.database.domain.Dataset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DatasetRepository extends JpaRepository<Dataset, Long> {

    long countByStudyId(Long studyId);

    List<Dataset> findByStudyIdOrderByIdAsc(Long studyId);
}
