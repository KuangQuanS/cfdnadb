# cfDNA Database Design Phase 1 Full-Stack Implementation Plan

Based on the `cfDNA_Database_Design.md` document, this is the comprehensive plan and task list for executing the Phase 1 MVP.

## 1. Task List

### Backend Implementation (Spring Boot + DuckDB)
- [ ] Add `org.duckdb:duckdb_jdbc` dependency to `pom.xml`.
- [ ] Implement `DuckDbService` to manage connections and query `/400T/cfdandb/` `.txt` files directly using `read_csv_auto`.
- [ ] Create `SummaryController` for `GET /api/v1/summary/cancers`.
- [ ] Create `VariantController` for `GET /api/v1/variants/top-genes` and `GET /api/v1/variants/by-gene`.

### Frontend Implementation (React + Vite)
- [ ] Transform `HeroCarousel.tsx` to include a prominent Gene/Biomarker Search Bar and quick biomarker stats directly on the main interface to emphasize cfDNA utility.
- [ ] Update `HomePage.tsx` to integrate the real Cancer Sample Statistics Matrix dynamically pulled from the backend.
- [ ] Create `GeneSearchPage.tsx` with inputs for Cancer and Gene Name, fetching from `/api/v1/variants/by-gene`, and rendering a detailed variants datatable.
- [ ] Create `ChartsPage.tsx` with TopN gene bar chart and PDF preview logic for `*_oncplot.pdf`.
- [ ] Add routing in `App.tsx` and navigation links in the TCGA style header (`AppShell.tsx`).

## 2. Technical Architecture

- **Backend Route:** No external MySQL/PostgreSQL will be used. DuckDB Embedded JDBC will map directly to the `/400T/cfdandb/{Cancer}` file paths, fulfilling the "serverless" text-parsing requirement.
- **Frontend Approach:** The existing "COSMIC + TCGA" themed UI will be extended. The Hero section will house the interactive Search Bar as the primary scientific entry point.

*This document serves as the execution roadmap for the development of the cfDNA MVP.*
