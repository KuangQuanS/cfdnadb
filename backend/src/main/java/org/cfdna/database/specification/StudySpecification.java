package org.cfdna.database.specification;

import org.cfdna.database.domain.Study;
import org.cfdna.database.dto.StudyQueryRequest;
import org.springframework.data.jpa.domain.Specification;

public final class StudySpecification {

    private StudySpecification() {
    }

    public static Specification<Study> withFilters(StudyQueryRequest request) {
        return (root, query, cb) -> {
            var predicate = cb.conjunction();
            if (hasText(request.getKeyword())) {
                String keyword = "%" + request.getKeyword().trim().toLowerCase() + "%";
                predicate = cb.and(predicate, cb.or(
                        cb.like(cb.lower(root.get("title")), keyword),
                        cb.like(cb.lower(root.get("accession")), keyword),
                        cb.like(cb.lower(root.get("journal")), keyword)
                ));
            }
            if (hasText(request.getDiseaseType())) {
                predicate = cb.and(predicate, cb.equal(root.get("diseaseType"), request.getDiseaseType()));
            }
            if (hasText(request.getSampleSource())) {
                predicate = cb.and(predicate, cb.equal(root.get("sampleSource"), request.getSampleSource()));
            }
            if (hasText(request.getTechnology())) {
                predicate = cb.and(predicate, cb.equal(root.get("technology"), request.getTechnology()));
            }
            if (request.getPublicationYear() != null) {
                predicate = cb.and(predicate, cb.equal(root.get("publicationYear"), request.getPublicationYear()));
            }
            return predicate;
        };
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
