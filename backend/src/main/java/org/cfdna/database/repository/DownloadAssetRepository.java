package org.cfdna.database.repository;

import org.cfdna.database.domain.DownloadAsset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DownloadAssetRepository extends JpaRepository<DownloadAsset, Long> {

    List<DownloadAsset> findByStudyIdOrderByNameAsc(Long studyId);

    List<DownloadAsset> findAllByOrderByCategoryAscNameAsc();

    Optional<DownloadAsset> findByIdAndPublicAssetTrue(Long id);
}
