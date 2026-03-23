# cfDNA Database Scaffold

This repository contains an initial full-stack scaffold for an academic-style cfDNA database site aimed at NAR-style database presentation.

## Structure
- `backend/`: Spring Boot API with Flyway migrations, demo data, download endpoints and OpenAPI UI
- `frontend/`: React + Vite portal with academic visual language, browse table, charts and detail pages
- `docs/`: architecture and field notes

## Backend features
- Core entities for studies, datasets, sample groups, biomarker records and download assets
- Public API endpoints for overview, browsing, detail, filters, visualizations and downloads
- PostgreSQL-oriented schema with Flyway seed data
- CSV import service interface for future structured-table ingestion

## Frontend features
- Six pages: Home, Browse, Study Detail, Downloads, Visualizations, About
- TanStack Query for data loading
- TanStack Table for browse results
- ECharts summary visualizations
- Fallback mock data so the UI remains navigable before the backend is running

## Local setup
### Backend
1. Install JDK 21.
2. Install PostgreSQL and create a database named `cfdnadb`.
3. Set optional env vars: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `CORS_ALLOWED_ORIGIN`.
4. Run `./mvnw spring-boot:run` from [backend](D:/OneDrive/website/cfdnadb/backend).

Note: the repository includes lightweight `mvnw` entry scripts, but not the official Maven Wrapper JAR. On a machine with Maven installed, regenerate the official wrapper if you want fully self-contained Maven bootstrap.

### Frontend
1. Install Node.js 20+.
2. Run `npm install` in [frontend](D:/OneDrive/website/cfdnadb/frontend).
3. Run `npm run dev`.
4. Optional: set `VITE_API_BASE_URL` if the API is hosted elsewhere.

## API docs
Once the backend is running, Swagger UI is available at [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html).

## Current limitations
- Not executed locally in this workspace because `java`, `mvn`, and `node` are not installed in PATH here.
- Seed data is illustrative demo content, not your final cfDNA curation.
- No admin UI, auth, or production deployment config yet.
