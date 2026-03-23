package org.cfdna.database.specification;

import org.cfdna.database.domain.BiomarkerRecord;
import org.cfdna.database.dto.RecordSearchRequest;
import org.springframework.data.jpa.domain.Specification;

public final class BiomarkerRecordSpecification {

    private BiomarkerRecordSpecification() {
    }

    public static Specification<BiomarkerRecord> withFilters(RecordSearchRequest request) {
        return (root, query, cb) -> {
            var predicate = cb.conjunction();
            if (hasText(request.getKeyword())) {
                String keyword = "%" + request.getKeyword().trim().toLowerCase() + "%";
                var studyJoin = root.join("study");
                predicate = cb.and(predicate, cb.or(
                        cb.like(cb.lower(root.get("markerName")), keyword),
                        cb.like(cb.lower(root.get("notes")), keyword),
                        cb.like(cb.lower(studyJoin.get("title")), keyword),
                        cb.like(cb.lower(studyJoin.get("accession")), keyword)
                ));
            }
            if (hasText(request.getDiseaseType())) {
                predicate = cb.and(predicate, cb.equal(root.get("diseaseType"), request.getDiseaseType()));
            }
            if (hasText(request.getTechnology())) {
                predicate = cb.and(predicate, cb.equal(root.join("study").get("technology"), request.getTechnology()));
            }
            if (hasText(request.getSampleSource())) {
                predicate = cb.and(predicate, cb.equal(root.join("study").get("sampleSource"), request.getSampleSource()));
            }
            if (hasText(request.getMarkerType())) {
                predicate = cb.and(predicate, cb.equal(root.get("markerType"), request.getMarkerType()));
            }
            if (hasText(request.getSpecimenType())) {
                predicate = cb.and(predicate, cb.equal(root.get("specimenType"), request.getSpecimenType()));
            }
            if (request.getPublicationYear() != null) {
                predicate = cb.and(predicate, cb.equal(root.join("study").get("publicationYear"), request.getPublicationYear()));
            }
            return predicate;
        };
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
