create table studies (
    id bigserial primary key,
    accession varchar(64) not null unique,
    title varchar(500) not null,
    disease_type varchar(120) not null,
    sample_source varchar(120) not null,
    technology varchar(120) not null,
    journal varchar(255),
    publication_year integer,
    doi varchar(255),
    pmid varchar(64),
    abstract_text varchar(3000),
    cohort_size integer,
    citation varchar(2000),
    created_at timestamp not null,
    updated_at timestamp not null
);

create table datasets (
    id bigserial primary key,
    study_id bigint not null references studies(id) on delete cascade,
    name varchar(255) not null,
    description varchar(1000),
    data_type varchar(120),
    record_count integer,
    file_format varchar(32),
    release_version varchar(32)
);

create table sample_groups (
    id bigserial primary key,
    dataset_id bigint not null references datasets(id) on delete cascade,
    group_name varchar(255) not null,
    condition_name varchar(120),
    sample_type varchar(120),
    sample_count integer
);

create table biomarker_records (
    id bigserial primary key,
    study_id bigint not null references studies(id) on delete cascade,
    marker_name varchar(255) not null,
    marker_type varchar(120) not null,
    chromosome_location varchar(120),
    regulation_direction varchar(64),
    assay_platform varchar(120),
    specimen_type varchar(120),
    disease_type varchar(120),
    significance_metric varchar(120),
    significance_value numeric(12, 4),
    effect_size numeric(12, 4),
    notes varchar(1000)
);

create table download_assets (
    id bigserial primary key,
    study_id bigint references studies(id) on delete cascade,
    name varchar(255) not null,
    category varchar(120) not null,
    description varchar(1000),
    file_name varchar(255) not null,
    file_path varchar(255) not null,
    content_type varchar(120) not null,
    file_size_bytes bigint not null,
    public_asset boolean not null default true
);

create index idx_studies_disease_type on studies(disease_type);
create index idx_studies_publication_year on studies(publication_year);
create index idx_biomarker_records_marker_type on biomarker_records(marker_type);
create index idx_biomarker_records_study_id on biomarker_records(study_id);
