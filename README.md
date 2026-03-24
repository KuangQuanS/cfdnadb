# cfDNA Database Scaffold

This repository contains an initial full-stack scaffold for an academic-style cfDNA database site aimed at NAR-style database presentation.

## Structure
- `backend/`: Spring Boot API, Flyway migrations, demo data, download endpoints and Tomcat WAR packaging
- `frontend/`: React + Vite portal source code that is built and bundled into the backend WAR
- `docs/`: architecture, field notes and deployment guidance

## Backend features
- Core entities for studies, datasets, sample groups, biomarker records and download assets
- Public API endpoints for overview, browsing, detail, filters, visualizations and downloads
- PostgreSQL-oriented schema with Flyway seed data
- CSV import service interface for future structured-table ingestion
- External Tomcat deployment as a single `war`

## Frontend features
- Pages: Home, Browse, Study Detail, VCF Demo, Downloads, Visualizations, About
- TanStack Query for data loading
- TanStack Table for browse results
- ECharts summary visualizations
- Fallback mock data so the UI remains navigable before the backend is running
- Built into the backend WAR during `mvn package`

## Local development
### Backend
1. Install JDK 21, Maven, Node.js 20+ and npm.
2. Optional: set `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` and `CORS_ALLOWED_ORIGINS`.
3. Run `mvn spring-boot:run` from [backend](D:/OneDrive/website/cfdnadb/backend).

Notes:
- If no database variables are provided, the scaffold starts with the in-memory H2 demo datasource.
- Default API port is `8080` for local development.

### Frontend
1. Run `npm install` in [frontend](D:/OneDrive/website/cfdnadb/frontend).
2. Run `npm run dev`.

## Deployment target
The project is prepared for a single Tomcat application:
- deploy `backend/target/cfdnadb.war`
- access the site at `https://leelab.kmmu.edu.cn/cfdnadb/`
- API is served at `https://leelab.kmmu.edu.cn/cfdnadb/api/v1/...`

See [deployment.md](D:/OneDrive/website/cfdnadb/docs/deployment.md) for the exact build and Tomcat deployment steps.

## API docs
Once deployed, Swagger UI is available at `/cfdnadb/swagger-ui.html`.

## Current limitations
- Seed data is illustrative demo content, not your final cfDNA curation.
- The VCF page is currently a frontend placeholder, not a real parser-backed browser.
- No admin UI, auth, or production-grade ingestion workflow yet.
