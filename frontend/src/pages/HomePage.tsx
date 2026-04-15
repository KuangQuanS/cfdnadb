import { Link } from "react-router-dom";
import { HeroCarousel } from "../components/HeroCarousel";
import { formatNumber } from "../utils/format";
import "../styles/home.css";

const TOOL_TILES = [
  {
    id: "01",
    title: "Gene Search",
    desc: "Query a gene and open sample-level mutation records.",
    link: "/gene-search",
    badge: "Gene-level query",
    preview: "search",
  },
  {
    id: "02",
    title: "Browse",
    desc: "Open oncoplots and cohort summary views by cancer type.",
    link: "/browse",
    badge: "Cohort-level view",
    preview: "bars",
  },
  {
    id: "03",
    title: "Downloads",
    desc: "Retrieve whole-cohort files and filtered multianno bundles.",
    link: "/downloads",
    badge: "Data access",
    preview: "table",
  },
] as const;

const DATA_LAYERS = [
  {
    id: "01",
    title: "Public cfDNA Studies",
    source: "GEO / PMID-curated",
    sampleCount: 476,
    note: "Curated external plasma cfDNA studies.",
  },
  {
    id: "02",
    title: "In-house Cohort",
    source: "Lee Lab",
    sampleCount: 1425,
    note: "Internal sequencing cohort processed with a unified pipeline.",
  },
  {
    id: "03",
    title: "TCGA Reference",
    source: "TCGA MAF",
    sampleCount: 6579,
    note: "Reference solid-tumor mutation set for comparison.",
  },
] as const;

export function HomePage() {
  return (
    <>
      <HeroCarousel />

      <main className="portal-home">
        <section className="portal-showcase-section animate-fade-up animate-fade-up-2">
          <div className="portal-section-inner">
            <div className="portal-showcase-hero">
              <div className="portal-showcase-copy">
                <span className="portal-showcase-kicker">Tools</span>
                <h2>Explore cfdnadb through focused analysis workflows</h2>
                <p>
                  Use the core interfaces to search genes, inspect cohort-level mutation patterns, and retrieve curated outputs without moving between disconnected pages.
                </p>
                <div className="portal-showcase-actions">
                  <Link to="/gene-search" className="portal-showcase-button">Open Gene Search</Link>
                </div>
              </div>

              <div className="portal-showcase-visual portal-showcase-visual--tools" aria-hidden="true">
                <div className="portal-ui-card">
                  <div className="portal-ui-topbar">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="portal-ui-grid">
                    <div className="portal-ui-panel portal-ui-panel--wide" />
                    <div className="portal-ui-panel" />
                    <div className="portal-ui-panel" />
                    <div className="portal-ui-panel portal-ui-panel--short" />
                    <div className="portal-ui-panel portal-ui-panel--chart" />
                    <div className="portal-ui-panel portal-ui-panel--chart" />
                  </div>
                </div>
              </div>
            </div>

            <div className="portal-showcase-band">
              <div className="portal-showcase-band-grid">
                {TOOL_TILES.map((tool) => (
                  <Link key={tool.title} to={tool.link} className="portal-tool-tile">
                    <div className={`portal-tool-preview portal-tool-preview--${tool.preview}`} aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="portal-tool-caption">
                      <strong>{tool.title}</strong>
                      <p>{tool.desc}</p>
                      <span>{tool.badge}</span>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="portal-showcase-sidecopy">
                <p>
                  The main workflows are organized around direct query, cohort browse, and export, so the homepage points to analysis tasks instead of decorative cards.
                </p>
                <Link to="/browse" className="portal-side-action">Open cohort browse</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="portal-showcase-section portal-showcase-section--data animate-fade-up animate-fade-up-3">
          <div className="portal-section-inner">
            <div className="portal-showcase-hero portal-showcase-hero--reverse">
              <div className="portal-showcase-copy">
                <span className="portal-showcase-kicker">Data Architecture</span>
                <h2>Three coordinated data layers support query and comparison</h2>
                <p>
                  cfdnadb integrates curated public cfDNA studies, internal plasma cohorts, and a TCGA solid-tumor reference so users can inspect cfDNA findings with a consistent comparison baseline.
                </p>
                <div className="portal-showcase-actions">
                  <Link to="/downloads" className="portal-showcase-button portal-showcase-button--secondary">Open Downloads</Link>
                </div>
              </div>

              <div className="portal-showcase-visual portal-showcase-visual--data" aria-hidden="true">
                <div className="portal-architecture-card">
                  {DATA_LAYERS.map((layer, index) => (
                    <div key={layer.title} className="portal-architecture-step">
                      <div className="portal-architecture-index">{layer.id}</div>
                      <div className="portal-architecture-body">
                        <strong>{layer.title}</strong>
                        <span>{layer.source}</span>
                      </div>
                      {index < DATA_LAYERS.length - 1 ? <div className="portal-architecture-connector" /> : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="portal-data-band">
              {DATA_LAYERS.map((layer) => (
                <article key={layer.title} className="portal-data-card">
                  <div className="portal-data-card-head">
                    <span>{layer.id}</span>
                    <strong>{formatNumber(layer.sampleCount)}</strong>
                  </div>
                  <div className="portal-data-card-body">
                    <h3>{layer.title}</h3>
                    <small>{layer.source}</small>
                    <p>{layer.note}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
