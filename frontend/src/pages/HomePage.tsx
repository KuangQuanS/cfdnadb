import { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { HeroCarousel } from "../components/HeroCarousel";
import { CANCER_OPTIONS, DEFAULT_CANCER, DEFAULT_GENE } from "../constants/cfdna";
import { formatNumber } from "../utils/format";

const DATA_SOURCES = [
  {
    title: "Public cfDNA studies",
    source: "Published GEO / PMID-curated cohorts",
    sampleCount: 476,
    note: "Curated plasma cfDNA studies integrated into a harmonized variant search layer."
  },
  {
    title: "In-house cfDNA cohort",
    source: "Lee Lab generated plasma sequencing data",
    sampleCount: 1425,
    note: "Self-generated cohort processed with the same calling and annotation pipeline used across the portal."
  },
  {
    title: "TCGA reference cohort",
    source: "TCGA MAF mutation reference layer",
    sampleCount: 6579,
    note: "Reference somatic mutation panel used for gene-level and cohort-level comparison."
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
      <div className="page-stack home-page-stack">
        <section className="home-search-band animate-fade-up">
          <div className="home-search-shell">
            <div className="home-search-copy">
              <p className="section-eyebrow">Variant search</p>
              <h2>Search cfDNA somatic variants by cohort and gene</h2>
              <p className="section-description">
                Query aggregated ANNOVAR-annotated multianno files across cancer cohorts. Enter a gene symbol to retrieve matched variant records with chromosomal coordinates, functional consequence, and per-sample barcode support.
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
            <div className="home-search-hints">
              <span>Start with Gene Search for a known target gene.</span>
              <span>Use Browse when you need cohort-wide exploration.</span>
              <span>Use Mutation Analysis and Downloads for comparison and export.</span>
            </div>
          </div>
        </section>

        <div className="home-info-grid animate-fade-up animate-fade-up-2">
          <section className="home-flat-section home-flat-section-tight">
            <div className="home-section-head">
              <div>
                <p className="section-eyebrow">Data foundation</p>
                <h3>What is currently inside the portal</h3>
              </div>
            </div>
            <p className="home-section-note">
              The current release combines curated public cfDNA studies, internally generated plasma cfDNA data, and a TCGA mutation reference layer for direct lookup and comparative interpretation.
            </p>
            <div className="home-dataset-grid">
              {DATA_SOURCES.map((item) => (
                <article key={item.title} className="home-dataset-row">
                  <div className="home-dataset-meta">
                    <h4>{item.title}</h4>
                    <p>{item.source}</p>
                  </div>
                  <div className="home-dataset-count">
                    <strong>{formatNumber(item.sampleCount)}</strong>
                    <span>samples</span>
                  </div>
                  <p className="home-dataset-note">{item.note}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="home-overview-section home-overview-panel">
            <div className="home-section-head">
              <div>
                <p className="section-eyebrow">About this resource</p>
                <h3>cfDNA Atlas</h3>
              </div>
            </div>
            <p className="home-reference-copy">
              cfDNA Atlas is a somatic mutation database for plasma cell-free DNA across multiple cancer cohorts. It is designed for direct variant lookup, cohort-level exploration, and downstream comparative analysis in liquid biopsy research.
            </p>
            <div className="home-reference-actions">
              <Link to="/browse" className="button-secondary inline-button home-secondary-button">Browse variants</Link>
              <Link to="/downloads" className="button-secondary inline-button home-secondary-button">Downloads</Link>
              <Link to="/about" className="button-secondary inline-button home-secondary-button">Citation</Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
