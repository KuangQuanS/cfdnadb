import { useQuery } from "@tanstack/react-query";
import { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCancerSummary, getDatabaseStats } from "../api/client";
import { HeroCarousel } from "../components/HeroCarousel";
import { CANCER_OPTIONS, DEFAULT_CANCER, DEFAULT_GENE } from "../constants/cfdna";
import { formatNumber } from "../utils/format";

function statusClass(status: string) {
  return status === "Completed" ? "success" : "";
}

const FEATURES = [
  {
    accent: "",
    iconClass: "",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
    title: "Gene-centric variant search",
    body: "Query somatic mutations by gene symbol across any cancer cohort. Supports partial matching against ANNOVAR-annotated Gene.refGene fields with functional class and exonic consequence filters. Results are paginated and exportable as CSV."
  },
  {
    accent: "accent-warm",
    iconClass: "warm",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
    title: "Multi-cohort statistical analysis",
    body: "Visualize variant functional region distributions, exonic mutation spectra, chromosomal burden maps, per-sample mutation load rankings, and cross-cohort top-gene frequency comparisons — all computed on-the-fly from aggregate multianno files via DuckDB."
  },
  {
    accent: "accent-green",
    iconClass: "green",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    ),
    title: "Open data access",
    body: "Download aggregate variant files, MAF summary tables, and pan-cancer datasets directly from the pipeline output directory. All files are served with transparent provenance and include per-sample barcodes traceable back to the original sequencing library."
  }
];

export function HomePage() {
  const navigate = useNavigate();
  const statsQuery = useQuery({ queryKey: ["db-stats"], queryFn: getDatabaseStats, staleTime: 5 * 60_000 });
  const cancerSummaryQuery = useQuery({ queryKey: ["cancer-summary"], queryFn: getCancerSummary });

  const stats = statsQuery.data;
  const cancerSummary = cancerSummaryQuery.data;

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const cancer = formData.get("cancer")?.toString() || DEFAULT_CANCER;
    const gene = formData.get("gene")?.toString().trim() || DEFAULT_GENE;
    navigate(`/gene-search?cancer=${encodeURIComponent(cancer)}&gene=${encodeURIComponent(gene)}`);
  };

  return (
    <>
      <HeroCarousel />
      <div className="page-stack">

        {/* Search */}
        <section className="home-search-band animate-fade-up">
          <div className="home-search-shell">
            <div className="home-search-copy">
              <p className="section-eyebrow">Variant search</p>
              <h2>Search cfDNA somatic variants by cohort and gene</h2>
              <p className="section-description">
                Query aggregated ANNOVAR-annotated multianno files across cancer cohorts. Enter a gene symbol to retrieve all matching variant records with functional annotation, chromosomal coordinates, and per-sample barcodes.
              </p>
            </div>
            <form className="hero-search-form home-search-form" onSubmit={handleSearch}>
              <div className="hero-search-grid home-search-grid">
                <label className="hero-field">
                  <span>Cancer cohort</span>
                  <select name="cancer" defaultValue={DEFAULT_CANCER}>
                    {CANCER_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label className="hero-field hero-field-wide">
                  <span>Gene symbol</span>
                  <input name="gene" type="text" defaultValue={DEFAULT_GENE} placeholder="TP53, KRAS, EGFR, PIK3CA..." />
                </label>
                <button type="submit" className="button-primary search-button">Search</button>
              </div>
            </form>
            <div className="search-tags">
              <span>Common queries:</span>
              <Link to="/gene-search?cancer=Breast&gene=TP53">Breast / TP53</Link>
              <Link to="/gene-search?cancer=Colonrector&gene=KRAS">Colorectal / KRAS</Link>
              <Link to="/gene-search?cancer=Breast&gene=PIK3CA">Breast / PIK3CA</Link>
              <Link to="/gene-search?cancer=Colonrector&gene=APC">Colorectal / APC</Link>
            </div>
          </div>
        </section>

        {/* Live stats */}
        <section className="animate-fade-up animate-fade-up-1">
          <p className="section-eyebrow" style={{ marginBottom: 16 }}>Database statistics</p>
          <div className="stat-grid">
            {[
              { label: "Somatic variants", value: stats ? formatNumber(stats.totalVariants) : "—" },
              { label: "cfDNA samples", value: stats ? formatNumber(stats.totalSamples) : "—" },
              { label: "Unique genes", value: stats ? formatNumber(stats.totalGenes) : "—" },
              { label: "Cancer cohorts", value: stats ? String(stats.cohortCount) : "—" }
            ].map((item) => (
              <div key={item.label} className="stat-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>

        {/* Feature cards */}
        <section className="animate-fade-up animate-fade-up-2">
          <p className="section-eyebrow" style={{ marginBottom: 20 }}>Key capabilities</p>
          <div className="feature-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className={`feature-card ${f.accent}`}>
                <div className={`feature-icon ${f.iconClass}`}>{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Cohort pipeline matrix */}
        <section className="detail-card animate-fade-up animate-fade-up-3">
          <div className="dataset-card-header" style={{ marginBottom: 24 }}>
            <div>
              <p className="section-eyebrow">Data availability</p>
              <h3>Cohort processing status</h3>
            </div>
            <Link to="/mutation-analysis" className="button-secondary inline-button">
              Open mutation analysis
            </Link>
          </div>
          <p style={{ marginBottom: 24, color: "var(--muted)", lineHeight: 1.75 }}>
            Pipeline stage completeness per cohort, derived from the server-side cfDNA directory. Variant search and statistical analysis are available for cohorts where the multianno annotation stage is marked complete. Remaining cohorts are actively being processed.
          </p>

          {cancerSummaryQuery.isLoading ? (
            <p className="panel-note">Loading cohort status...</p>
          ) : cancerSummaryQuery.isError ? (
            <p className="panel-note">Cohort status unavailable — backend connection required.</p>
          ) : (
            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cohort</th>
                    <th>Samples</th>
                    <th>Tracked Files</th>
                    <th>Raw Import</th>
                    <th>Filtered VCF</th>
                    <th>Multianno</th>
                    <th>Somatic VCF</th>
                    <th>Plot Assets</th>
                    <th>External Data</th>
                  </tr>
                </thead>
                <tbody>
                  {cancerSummary?.map((row) => (
                    <tr key={row.cancer}>
                      <td style={{ fontWeight: 700 }}>{row.cancer}</td>
                      <td>{formatNumber(row.sampleCount)}</td>
                      <td>{formatNumber(row.totalDataFiles)}</td>
                      <td><span className={`status-chip ${statusClass(row.rawImportStatus)}`}>{row.rawImportStatus}</span></td>
                      <td><span className={`status-chip ${statusClass(row.filteredStatus)}`}>{row.filteredStatus}</span></td>
                      <td><span className={`status-chip ${statusClass(row.annotatedStatus)}`}>{row.annotatedStatus}</span></td>
                      <td><span className={`status-chip ${statusClass(row.somaticStatus)}`}>{row.somaticStatus}</span></td>
                      <td><span className={`status-chip ${statusClass(row.plotStatus)}`}>{row.plotStatus}</span></td>
                      <td><span className={`status-chip ${statusClass(row.externalStatus)}`}>{row.externalStatus}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Academic info grid */}
        <div className="detail-grid animate-fade-up animate-fade-up-4">
          <section className="detail-card">
            <p className="section-eyebrow">About this resource</p>
            <h3>cfDNA Atlas</h3>
            <p style={{ color: "var(--muted)", lineHeight: 1.8, marginBottom: 16 }}>
              cfDNA Atlas is an academic database of somatic mutations identified from plasma cell-free DNA across multiple cancer cohorts. Liquid biopsy samples were sequenced and processed through a standardized bioinformatics pipeline. Variants were called using MuTect2 with matched normal panels, filtered, and annotated against the hg38 genome using ANNOVAR with refGene, ExAC, 1000G, and ClinVar databases.
            </p>
            <p style={{ color: "var(--muted)", lineHeight: 1.8 }}>
              The portal enables gene-centric queries, functional consequence filtering, cross-cohort comparison, and bulk data download. It is designed to support independent replication, biomarker discovery, and landscape analyses of cfDNA somatic variation across cancer types.
            </p>
            <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link to="/browse" className="button-secondary inline-button">Browse variants</Link>
              <Link to="/about" className="button-secondary inline-button">Citation</Link>
            </div>
          </section>

          <section className="detail-card">
            <p className="section-eyebrow">Variant calling pipeline</p>
            <h3>Processing workflow</h3>
            <dl>
              {[
                ["Input", "cfDNA plasma samples, targeted panel / WES"],
                ["Alignment", "BWA-MEM, hg38 reference genome"],
                ["Variant calling", "MuTect2 somatic variant caller (GATK4)"],
                ["Filtering", "FilterMutectCalls with panel of normals"],
                ["Annotation", "ANNOVAR: refGene, ExAC, 1000G, ClinVar"],
                ["Aggregation", "Per-cohort multianno TSV, DuckDB query layer"]
              ].map(([key, val]) => (
                <div key={key} style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                  <dt style={{ color: "var(--subtle)", fontWeight: 700, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{key}</dt>
                  <dd style={{ margin: 0, color: "var(--ink)", fontWeight: 500 }}>{val}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

      </div>
    </>
  );
}
