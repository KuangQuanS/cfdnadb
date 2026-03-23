# Data Dictionary Draft

## Study
- `accession`: stable public study identifier
- `title`: full publication or dataset title
- `disease_type`: primary disease context used in browsing filters
- `sample_source`: source material such as plasma or urine
- `technology`: assay platform or sequencing method
- `journal`: publication venue
- `publication_year`: year of publication
- `doi`, `pmid`: reference identifiers
- `cohort_size`: total enrolled or analyzed samples
- `citation`: recommended citation string

## BiomarkerRecord
- `marker_name`: biomarker or signature name
- `marker_type`: broad category such as methylation, mutation, fragmentomics or composite signature
- `chromosome_location`: optional genomic location
- `regulation_direction`: optional direction label
- `assay_platform`: assay-level platform string
- `specimen_type`: specimen used for the record-level evidence
- `significance_metric`: AUC, sensitivity, odds ratio or other metric label
- `significance_value`: primary numeric metric
- `effect_size`: optional secondary effect size
- `notes`: free-text curation note

## DownloadAsset
- `category`: full release, study subset or documentation grouping
- `file_name`: client-facing file name
- `file_path`: classpath location in the prototype
- `content_type`: MIME type used for downloads
- `file_size_bytes`: display and response metadata
