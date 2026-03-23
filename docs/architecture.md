# Architecture Notes

## Stack
- Backend: Spring Boot 3, Spring Web, Spring Data JPA, Flyway, PostgreSQL
- Frontend: React 18, Vite, TypeScript, TanStack Query, TanStack Table, Apache ECharts
- Deployment target: public academic database site with separated frontend/backend services

## Core entities
- `Study`: publication-level metadata and citation context
- `Dataset`: downloadable or curated sub-dataset attached to a study
- `SampleGroup`: cohort or subgroup counts within a dataset
- `BiomarkerRecord`: marker-level evidence used for browsing and summary tables
- `DownloadAsset`: full release files, subsets and field dictionaries

## Public API
- `GET /api/v1/overview`
- `GET /api/v1/studies`
- `GET /api/v1/studies/{id}`
- `GET /api/v1/records`
- `GET /api/v1/filters`
- `GET /api/v1/visualizations/summary`
- `GET /api/v1/downloads`
- `GET /api/v1/downloads/{id}/file`

## Frontend page map
- `Home`: hero summary, headline counts, entry-point charts
- `Browse`: filtering and biomarker-level table
- `Study Detail`: publication summary, datasets, groups and representative markers
- `Downloads`: grouped public releases
- `Visualizations`: database-level summary charts
- `About`: manuscript/citation copy
