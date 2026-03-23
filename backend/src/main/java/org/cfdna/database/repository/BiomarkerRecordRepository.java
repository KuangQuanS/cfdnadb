package org.cfdna.database.repository;

import org.cfdna.database.domain.BiomarkerRecord;
import org.cfdna.database.repository.projection.LabelCountView;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface BiomarkerRecordRepository extends JpaRepository<BiomarkerRecord, Long>, JpaSpecificationExecutor<BiomarkerRecord> {

    long countByStudyId(Long studyId);

    List<BiomarkerRecord> findTop10ByStudyIdOrderByIdAsc(Long studyId);

    @Query("select distinct b.markerType from BiomarkerRecord b order by b.markerType")
    List<String> findDistinctMarkerTypes();

    @Query("select distinct b.specimenType from BiomarkerRecord b order by b.specimenType")
    List<String> findDistinctSpecimenTypes();

    @Query("select b.markerType as label, count(b) as count from BiomarkerRecord b group by b.markerType order by count(b) desc")
    List<LabelCountView> countByMarkerType(Pageable pageable);
}
