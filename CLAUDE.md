# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

cfDNA Database — a full-stack academic portal for cancer cell-free DNA research data. Spring Boot 2.7 backend (Java 11) + React 18 frontend (TypeScript, Vite), packaged as a single WAR (`cfdnadb.war`) for Tomcat deployment at `/cfdnadb/`.

## Build & Run Commands

```bash
# Full build (backend + frontend bundled into WAR)
cd backend && mvn clean package

# Skip tests
cd backend && mvn clean package -DskipTests

# Run backend locally (H2 in-memory demo DB, port 8080)
cd backend && mvn spring-boot:run

# Run frontend dev server (port 5173, proxies /api to localhost:8080)
cd frontend && npm install && npm run dev

# Run all tests
cd backend && mvn test

# Run a single test class
cd backend && mvn test -Dtest=CfDnaEndpointsIntegrationTest

# Run a single test method
cd backend && mvn test -Dtest=CfDnaEndpointsIntegrationTest#topGenes_returns200
```

## Architecture

### Backend (`backend/`)
- **Spring Boot 2.7.18**, packaged as WAR
- **DuckDbService** (`service/DuckDbService.java`) — core service that queries cancer data files directly from the filesystem using embedded DuckDB JDBC. Reads `.txt` aggregate files (e.g., `Breast_all_sample_multianno.txt`) from a configurable data root (`/400T/cfdandb/` in production)
- **Controllers**: `VariantController` (top-genes, by-gene), `CancerSummaryController` (cohort status), `CancerAssetController` (PDF assets), plus legacy controllers (Overview, Study, Record, Download)
- **SpaForwardController** — catches non-API, non-static routes and forwards to `index.html` for SPA routing
- **Database**: H2 in-memory by default (Flyway migrations seed demo data). Override with `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` env vars for PostgreSQL
- **Swagger UI** available at `/swagger-ui.html`

### Frontend (`frontend/`)
- **React 18 + TypeScript + Vite**
- **TanStack Query** for server state; **TanStack Table** for data tables; **ECharts** for charts
- **api/client.ts** — central fetch wrapper. On API error, falls back to mock data from `api/mockData.ts`, keeping the UI navigable when backend is unreachable
- **Key pages**: `HomePage` (dashboard + cohort matrix), `GeneSearchPage` (paginated variant search), `ChartsPage` (top-gene chart + PDF assets)
- **Base path** configured via `VITE_APP_BASE_PATH` (default `/cfdnadb/` for production, `/` for local dev)

### API Response Convention
All endpoints wrap responses in `{ success, data, message, timestamp }`. Paginated endpoints use `PagedResponse<T>` with `content`, `totalElements`, `totalPages`, `page`, `size`.

### Build Pipeline
Maven `pom.xml` orchestrates the full build: runs `npm ci` + `npm run build` in `frontend/`, copies `frontend/dist/` into `target/classes/static/`, then packages as WAR. No separate frontend deployment needed.

### Supported Cancer Cohorts
Breast, Colonrector, Liver, Lung, Pdac — defined in both `constants/cfdna.ts` (frontend) and `DuckDbService.java` (backend).

## Testing

Integration tests use `@SpringBootTest` + `@AutoConfigureMockMvc` with `@ActiveProfiles("test")`. Test config is in `backend/src/test/resources/application-test.yml`.

## Deployment

WAR deploys to Tomcat at context path `/cfdnadb/`. Production URL: `https://leelab.kmmu.edu.cn/cfdnadb/`. Set env vars `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `CORS_ALLOWED_ORIGINS` in Tomcat's `setenv.sh`.
