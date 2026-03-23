insert into studies (accession, title, disease_type, sample_source, technology, journal, publication_year, doi, pmid, abstract_text, cohort_size, citation, created_at, updated_at)
values
    ('CFDNA-001', 'Genome-wide cfDNA methylation landscape for early hepatocellular carcinoma detection', 'Hepatocellular carcinoma', 'Plasma', 'Targeted methylation sequencing', 'Nature Medicine', 2024, '10.1000/cfdna001', '39800001', 'A curated multicenter cfDNA methylation study focused on liver cancer screening cohorts.', 286, 'Author A et al. Nature Medicine (2024).', current_timestamp, current_timestamp),
    ('CFDNA-002', 'Fragmentomics signatures distinguish colorectal cancer and advanced adenoma', 'Colorectal cancer', 'Plasma', 'Whole-genome sequencing', 'Gut', 2023, '10.1000/cfdna002', '39800002', 'This study benchmarks fragment length, end motif and copy-number signals across colorectal cohorts.', 198, 'Author B et al. Gut (2023).', current_timestamp, current_timestamp),
    ('CFDNA-003', 'Urine cfDNA mutation panel for bladder cancer surveillance', 'Bladder cancer', 'Urine', 'Targeted panel sequencing', 'Clinical Cancer Research', 2022, '10.1000/cfdna003', '39800003', 'A longitudinal urine cfDNA panel study evaluating surveillance performance after surgery.', 142, 'Author C et al. Clin Cancer Res (2022).', current_timestamp, current_timestamp);

insert into datasets (study_id, name, description, data_type, record_count, file_format, release_version)
values
    ((select id from studies where accession = 'CFDNA-001'), 'Discovery cohort methylation markers', 'Candidate methylation biomarkers from the discovery cohort.', 'Methylation markers', 124, 'CSV', 'v1.0'),
    ((select id from studies where accession = 'CFDNA-001'), 'Validation cohort sample annotations', 'Clinical and sample-level annotations for validation participants.', 'Sample metadata', 162, 'XLSX', 'v1.0'),
    ((select id from studies where accession = 'CFDNA-002'), 'Fragmentomic signature matrix', 'Fragment size and end motif summary matrix.', 'Fragmentomics', 98, 'CSV', 'v1.1'),
    ((select id from studies where accession = 'CFDNA-003'), 'Urine mutation panel calls', 'Driver mutation calls across surveillance visits.', 'Mutation panel', 73, 'CSV', 'v1.0');

insert into sample_groups (dataset_id, group_name, condition_name, sample_type, sample_count)
values
    ((select id from datasets where name = 'Discovery cohort methylation markers'), 'Discovery HCC cases', 'Case', 'Plasma cfDNA', 82),
    ((select id from datasets where name = 'Discovery cohort methylation markers'), 'Discovery controls', 'Control', 'Plasma cfDNA', 54),
    ((select id from datasets where name = 'Validation cohort sample annotations'), 'Validation HCC cases', 'Case', 'Plasma cfDNA', 96),
    ((select id from datasets where name = 'Validation cohort sample annotations'), 'Validation controls', 'Control', 'Plasma cfDNA', 66),
    ((select id from datasets where name = 'Fragmentomic signature matrix'), 'CRC cases', 'Case', 'Plasma cfDNA', 120),
    ((select id from datasets where name = 'Fragmentomic signature matrix'), 'Advanced adenoma', 'Case', 'Plasma cfDNA', 38),
    ((select id from datasets where name = 'Urine mutation panel calls'), 'Surveillance positives', 'Case', 'Urine cfDNA', 61),
    ((select id from datasets where name = 'Urine mutation panel calls'), 'Surveillance negatives', 'Control', 'Urine cfDNA', 81);

insert into biomarker_records (study_id, marker_name, marker_type, chromosome_location, regulation_direction, assay_platform, specimen_type, disease_type, significance_metric, significance_value, effect_size, notes)
values
    ((select id from studies where accession = 'CFDNA-001'), 'cgHCC_104', 'DNA methylation', 'chr1:145002-145178', 'Hyper', 'Targeted methylation sequencing', 'Plasma', 'Hepatocellular carcinoma', 'AUC', 0.9310, 1.8200, 'Stable performance in independent validation.'),
    ((select id from studies where accession = 'CFDNA-001'), 'cgHCC_287', 'DNA methylation', 'chr8:125120-125340', 'Hyper', 'Targeted methylation sequencing', 'Plasma', 'Hepatocellular carcinoma', 'AUC', 0.9140, 1.6400, 'Associated with cirrhosis-aware classifier.'),
    ((select id from studies where accession = 'CFDNA-001'), 'LiverScore', 'Composite signature', null, 'Up', 'Targeted methylation sequencing', 'Plasma', 'Hepatocellular carcinoma', 'AUC', 0.9520, 2.4100, 'Integrated multiregion classifier.'),
    ((select id from studies where accession = 'CFDNA-002'), 'FragShift-27', 'Fragmentomics', 'chr5q31', 'Up', 'Whole-genome sequencing', 'Plasma', 'Colorectal cancer', 'AUC', 0.8870, 1.4500, 'Fragment length skew score.'),
    ((select id from studies where accession = 'CFDNA-002'), 'EndMotif-AT', 'End motif', null, 'Up', 'Whole-genome sequencing', 'Plasma', 'Colorectal cancer', 'OR', 2.3800, 2.3800, 'Enriched motif usage in CRC cases.'),
    ((select id from studies where accession = 'CFDNA-002'), 'CRC-Integrated', 'Composite signature', null, 'Up', 'Whole-genome sequencing', 'Plasma', 'Colorectal cancer', 'AUC', 0.9050, 1.9800, 'Combines fragmentomics and copy number.'),
    ((select id from studies where accession = 'CFDNA-003'), 'TERT C228T', 'Mutation', 'chr5:1295228', 'Mutated', 'Targeted panel sequencing', 'Urine', 'Bladder cancer', 'Sensitivity', 0.7600, 1.2900, 'Most frequent recurrent hotspot.'),
    ((select id from studies where accession = 'CFDNA-003'), 'FGFR3 S249C', 'Mutation', 'chr4:1807894', 'Mutated', 'Targeted panel sequencing', 'Urine', 'Bladder cancer', 'Sensitivity', 0.5200, 1.1100, 'Common in low-grade recurrence.'),
    ((select id from studies where accession = 'CFDNA-003'), 'SurveilPanel', 'Composite signature', null, 'Up', 'Targeted panel sequencing', 'Urine', 'Bladder cancer', 'AUC', 0.8460, 1.6700, 'Panel-level surveillance score.');

insert into download_assets (study_id, name, category, description, file_name, file_path, content_type, file_size_bytes, public_asset)
values
    (null, 'cfDNA master release', 'Full database release', 'Combined curated study, dataset and biomarker release.', 'cfdna_master_release.csv', 'downloads/cfdna_master_release.csv', 'text/csv', 412, true),
    (null, 'Field dictionary', 'Documentation', 'Data dictionary for the public schema.', 'field_dictionary.csv', 'downloads/field_dictionary.csv', 'text/csv', 288, true),
    ((select id from studies where accession = 'CFDNA-001'), 'HCC methylation subset', 'Study subset', 'Study-specific release for the HCC methylation cohort.', 'hcc_methylation_subset.csv', 'downloads/hcc_methylation_subset.csv', 'text/csv', 218, true),
    ((select id from studies where accession = 'CFDNA-002'), 'CRC fragmentomics subset', 'Study subset', 'Study-specific release for the CRC fragmentomics cohort.', 'crc_fragmentomics_subset.csv', 'downloads/crc_fragmentomics_subset.csv', 'text/csv', 219, true);
