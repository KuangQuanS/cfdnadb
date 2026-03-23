package org.cfdna.database.repository;

import org.cfdna.database.domain.Study;
import org.cfdna.database.repository.projection.LabelCountView;
import org.cfdna.database.repository.projection.YearCountView;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface StudyRepository extends JpaRepository<Study, Long>, JpaSpecificationExecutor<Study> {

    Optional<Study> findByAccession(String accession);

    @Query("select distinct s.diseaseType from Study s order by s.diseaseType")
    List<String> findDistinctDiseaseTypes();

    @Query("select distinct s.sampleSource from Study s order by s.sampleSource")
    List<String> findDistinctSampleSources();

    @Query("select distinct s.technology from Study s order by s.technology")
    List<String> findDistinctTechnologies();

    @Query("select distinct s.publicationYear from Study s order by s.publicationYear desc")
    List<Integer> findDistinctPublicationYears();

    @Query("select s.diseaseType as label, count(s) as count from Study s group by s.diseaseType order by count(s) desc")
    List<LabelCountView> countByDiseaseType(Pageable pageable);

    @Query("select s.technology as label, count(s) as count from Study s group by s.technology order by count(s) desc")
    List<LabelCountView> countByTechnology(Pageable pageable);

    @Query("select s.sampleSource as label, count(s) as count from Study s group by s.sampleSource order by count(s) desc")
    List<LabelCountView> countBySampleSource(Pageable pageable);

    @Query("select s.publicationYear as year, count(s) as count from Study s group by s.publicationYear order by s.publicationYear")
    List<YearCountView> countByPublicationYear();
}
