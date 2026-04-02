import { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { HeroCarousel } from "../components/HeroCarousel";
import { CANCER_OPTIONS, DEFAULT_CANCER, DEFAULT_GENE } from "../constants/cfdna";
import { formatNumber } from "../utils/format";
import "../styles/home.css";

const DATA_SOURCES = [
  {
    title: "Public cfDNA Studies",
    source: "GEO / PMID-curated",
    sampleCount: 476,
    note: "Harmonized and curated external plasma cfDNA datasets."
  },
  {
    title: "In-house Cohort",
    source: "Lee Lab",
    sampleCount: 1425,
    note: "Proprietary sequencing data processed via standardized pipeline."
  },
  {
    title: "TCGA Reference",
    source: "TCGA MAF",
    sampleCount: 6579,
    note: "Baseline somatic mutation data for gene and cohort comparison."
  }
];

const FEATURES = [
  {
    title: "Gene Search",
    desc: "Targeted querying of somatic variants by gene symbol with comprehensive functional annotations.",
    link: "/gene-search",
    icon: "🔬",
  },
  {
    title: "Statistical Analysis",
    desc: "Interactive cohort-level mutation plots and gene-specific structural distribution visualization.",
    link: "/statistics",
    icon: "📊",
  },
  {
    title: "Data Downloads",
    desc: "Access annotated tables, MAF summaries, and raw standardized data for downstream research.",
    link: "/downloads",
    icon: "📥",
  }
];

export function HomePage() {
  const navigate = useNavigate();

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

      <main className="portal-home">
        {/* Unified Search Section */}
        <section className="portal-search-section">
          <div className="portal-search-container animate-fade-up">
            <div className="portal-search-header">
              <h2>Query Somatic Variants</h2>
              <p>Search across multianno cohorts using standardized gene symbols</p>
            </div>
            
            <form className="portal-query-builder" onSubmit={handleSearch}>
              <div className="portal-query-input-group">
                <div className="portal-query-field cohort-select">
                  <span className="field-label">Cohort</span>
                  <select name="cancer" defaultValue={DEFAULT_CANCER}>
                    {CANCER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="portal-query-divider" />
                <div className="portal-query-field gene-input">
                  <span className="field-label">Gene Symbol</span>
                  <input name="gene" type="text" defaultValue={DEFAULT_GENE} placeholder="e.g. TP53, KRAS, EGFR" />
                </div>
                <button type="submit" className="portal-query-submit">Search</button>
              </div>
            </form>
            
            <div className="portal-query-examples">
              <span>Examples:</span>
              <div className="example-links">
                <Link to="/gene-search?cancer=Breast&gene=TP53">Breast / TP53</Link>
                <Link to="/gene-search?cancer=Colonrector&gene=KRAS">Colorectal / KRAS</Link>
                <Link to="/gene-search?cancer=Lung&gene=EGFR">Lung / EGFR</Link>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Modules */}
        <section className="portal-modules-section animate-fade-up animate-fade-up-2">
          <div className="portal-section-title">
            <h2>Analytical Modules</h2>
            <div className="title-underline" />
          </div>
          <div className="portal-modules-grid">
            {FEATURES.map((f) => (
              <Link key={f.title} to={f.link} className="portal-module-card">
                <div className="module-icon">{f.icon}</div>
                <div className="module-content">
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
                <div className="module-action">Explore &rarr;</div>
              </Link>
            ))}
          </div>
        </section>

        {/* Data Architecture */}
        <section className="portal-data-section animate-fade-up animate-fade-up-3">
          <div className="portal-section-title">
            <h2>Data Architecture</h2>
            <div className="title-underline" />
            <p className="section-subtitle">Triple-layered harmonized somatic data for robust comparative analysis.</p>
          </div>
          <div className="portal-data-grid">
            {DATA_SOURCES.map((d, i) => (
              <div key={d.title} className="portal-data-item">
                <div className="data-item-number">0{i + 1}</div>
                <div className="data-item-details">
                  <span className="data-count">{formatNumber(d.sampleCount)} Samples</span>
                  <h4>{d.title}</h4>
                  <p>{d.note}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer / About Note */}
        <section className="portal-about-section animate-fade-up animate-fade-up-4">
          <div className="portal-about-content">
            <h2>About cfDNA Atlas</h2>
            <p>
              The cfDNA Atlas is an academic somatic mutation database indexing plasma cell-free DNA 
              across diverse cancer cohorts. Built for precision oncology, the platform supports 
              direct variant lookups, comprehensive cohort-level statistics, and downstream 
              comparative computational analysis.
            </p>
            <div className="portal-about-actions">
              <Link to="/browse" className="btn-solid">Browse Data Matrix</Link>
              <Link to="/downloads" className="btn-outline">Access Repositories</Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
