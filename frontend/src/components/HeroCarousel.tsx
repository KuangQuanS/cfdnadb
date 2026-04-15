import { type CSSProperties, type FormEvent, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { getCancerSummary } from "../api/client";
import { CANCER_OPTIONS, DEFAULT_CANCER, DEFAULT_GENE, HERO_QUICK_LINKS } from "../constants/cfdna";
import type { CancerSummary } from "../types/api";
import { formatNumber } from "../utils/format";
import humanBodyImg from "../assets/human_body.png";
import "../styles/home.css";

const MOCK_COHORTS: CancerSummary[] = [
  { cancer: "Breast", sampleCount: 486, totalDataFiles: 972, avinputCount: 486, filteredCount: 486, annotatedCount: 486, somaticCount: 0, plotAssetCount: 12, externalAssetCount: 8, rawImportStatus: "Completed", filteredStatus: "Completed", annotatedStatus: "Completed", somaticStatus: "Not started", plotStatus: "Completed", externalStatus: "Completed" },
  { cancer: "Colonrector", sampleCount: 352, totalDataFiles: 704, avinputCount: 352, filteredCount: 352, annotatedCount: 352, somaticCount: 0, plotAssetCount: 10, externalAssetCount: 6, rawImportStatus: "Completed", filteredStatus: "Completed", annotatedStatus: "Completed", somaticStatus: "Not started", plotStatus: "Completed", externalStatus: "Completed" },
  { cancer: "Liver", sampleCount: 278, totalDataFiles: 556, avinputCount: 278, filteredCount: 278, annotatedCount: 278, somaticCount: 0, plotAssetCount: 8, externalAssetCount: 4, rawImportStatus: "Completed", filteredStatus: "Completed", annotatedStatus: "Completed", somaticStatus: "Not started", plotStatus: "Completed", externalStatus: "Completed" },
  { cancer: "Lung", sampleCount: 312, totalDataFiles: 624, avinputCount: 312, filteredCount: 312, annotatedCount: 312, somaticCount: 0, plotAssetCount: 9, externalAssetCount: 5, rawImportStatus: "Completed", filteredStatus: "Completed", annotatedStatus: "Completed", somaticStatus: "Not started", plotStatus: "Completed", externalStatus: "Completed" },
  { cancer: "Pdac", sampleCount: 99, totalDataFiles: 198, avinputCount: 99, filteredCount: 99, annotatedCount: 99, somaticCount: 0, plotAssetCount: 5, externalAssetCount: 3, rawImportStatus: "Completed", filteredStatus: "Completed", annotatedStatus: "Completed", somaticStatus: "Not started", plotStatus: "Completed", externalStatus: "Completed" },
];

const COHORT_COLORS: Record<string, string> = {
  Breast: "#eb6a7f",
  Colonrector: "#5a49b7",
  Liver: "#28a07f",
  Lung: "#2f79b7",
  Pdac: "#f29a4a",
};

const COHORT_LABELS: Record<string, string> = {
  Breast: "Breast",
  Colonrector: "Colorectal",
  Liver: "Liver",
  Lung: "Lung",
  Pdac: "Pancreatic",
};

const COHORT_ORDER = ["Breast", "Colonrector", "Lung", "Liver", "Pdac"] as const;

const CALLOUTS = [
  { id: "Lung", label: "Lung", side: "left", topPct: 34, anchorPct: 39, browseKey: "Lung" },
  { id: "Liver", label: "Liver", side: "left", topPct: 51, anchorPct: 38, browseKey: "Liver" },
  { id: "Breast", label: "Breast", side: "right", topPct: 38, anchorPct: 61, browseKey: "Breast" },
  { id: "Pdac", label: "Pancreas", side: "right", topPct: 56, anchorPct: 60, browseKey: "Pancreatic" },
  { id: "Colonrector", label: "Colorectal", side: "right", topPct: 68, anchorPct: 58, browseKey: "Colorectal" },
] as const;

type HeroRingEntry = {
  id: string;
  label: string;
  color: string;
  value: number;
};

function buildDonutGradient(entries: HeroRingEntry[]) {
  if (!entries.length) {
    return "conic-gradient(#d6e0ef 0deg 360deg)";
  }

  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  let cursor = 0;
  const stops = entries.map((entry) => {
    const start = cursor;
    const sweep = total > 0 ? (entry.value / total) * 360 : 0;
    cursor += sweep;
    return `${entry.color} ${start.toFixed(2)}deg ${cursor.toFixed(2)}deg`;
  });

  return `conic-gradient(${stops.join(", ")})`;
}

function HeroRingChart({
  title,
  total,
  subtitle,
  entries,
}: {
  title: string;
  total: number;
  subtitle: string;
  entries: HeroRingEntry[];
}) {
  return (
    <article className="gdc-overview-chart" aria-label={title}>
      <div className="gdc-overview-ring" style={{ backgroundImage: buildDonutGradient(entries) }}>
        <div className="gdc-overview-ring-core">
          <strong>{formatNumber(total)}</strong>
          <span>{title}</span>
        </div>
      </div>
      <div className="gdc-overview-chart-copy">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </article>
  );
}

export function HeroCarousel() {
  const navigate = useNavigate();
  const cancerQuery = useQuery({ queryKey: ["cancer-summary"], queryFn: getCancerSummary, staleTime: 5 * 60_000 });
  const cohorts = cancerQuery.data?.length ? cancerQuery.data : MOCK_COHORTS;
  const countMap = useMemo(
    () => Object.fromEntries(cohorts.map((c) => [c.cancer, c.sampleCount])),
    [cohorts],
  );
  const ringEntries = useMemo(
    () => COHORT_ORDER
      .map((cohortId) => {
        const cohort = cohorts.find((item) => item.cancer === cohortId);
        if (!cohort) return null;
        return {
          id: cohortId,
          label: COHORT_LABELS[cohortId],
          color: COHORT_COLORS[cohortId],
          sampleCount: cohort.sampleCount,
          fileCount: cohort.totalDataFiles,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    [cohorts],
  );
  const totalSamples = useMemo(
    () => ringEntries.reduce((sum, entry) => sum + entry.sampleCount, 0),
    [ringEntries],
  );
  const totalFiles = useMemo(
    () => ringEntries.reduce((sum, entry) => sum + entry.fileCount, 0),
    [ringEntries],
  );
  const sampleRingEntries = useMemo(
    () => ringEntries.map(({ id, label, color, sampleCount }) => ({ id, label, color, value: sampleCount })),
    [ringEntries],
  );
  const fileRingEntries = useMemo(
    () => ringEntries.map(({ id, label, color, fileCount }) => ({ id, label, color, value: fileCount })),
    [ringEntries],
  );

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const cancer = fd.get("cancer")?.toString() || DEFAULT_CANCER;
    const gene = fd.get("gene")?.toString().trim() || DEFAULT_GENE;
    navigate(`/gene-search?source=cfDNA&cancer=${encodeURIComponent(cancer)}&gene=${encodeURIComponent(gene)}`);
  };

  const goToBrowse = (browseKey: string) => {
    navigate(`/browse?cancer=${encodeURIComponent(browseKey)}`);
  };

  return (
    <section className="gdc-hero">
      <div className="gdc-hero-inner">

        <div className="gdc-col-left">
          <h1 className="gdc-title">cfDNA cancer<br />database</h1>
          <p className="gdc-subtitle">
            A curated resource of plasma cell-free DNA somatic mutations spanning five cancer cohorts.
            Supports cohort-level browse, gene-level query, and downloadable analysis outputs for academic research.
          </p>
          <div className="gdc-hero-links">
            <Link to="/browse" className="gdc-hero-link gdc-hero-link--primary">Browse cohorts</Link>
            <Link to="/gene-search" className="gdc-hero-link">Gene search</Link>
          </div>
        </div>

        <div className="gdc-col-middle">
          <div className="body-map">
            <img src={humanBodyImg} alt="Human body diagram with cancer sites" className="gdc-body-img" />

            {CALLOUTS.map((cfg) => (
              <button
                key={cfg.id}
                type="button"
                className={`body-callout body-callout--${cfg.side}`}
                style={{ top: `${cfg.topPct}%`, "--anchor-x": `${cfg.anchorPct}%` } as CSSProperties}
                onClick={() => goToBrowse(cfg.browseKey)}
                aria-label={`Browse ${cfg.label} cohort`}
              >
                {cfg.side === "left" ? (
                  <>
                    <div className="callout-label">
                      <strong>{cfg.label}</strong>
                      <span>{formatNumber(countMap[cfg.id] ?? 0)}</span>
                    </div>
                    <div className="callout-stem" />
                    <div className="callout-dot" />
                  </>
                ) : (
                  <>
                    <div className="callout-dot" />
                    <div className="callout-stem" />
                    <div className="callout-label">
                      <strong>{cfg.label}</strong>
                      <span>{formatNumber(countMap[cfg.id] ?? 0)}</span>
                    </div>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="gdc-col-right">
          <div className="gdc-side-rail">
            <div className="gdc-overview-grid">
              <HeroRingChart
                title="Samples"
                total={totalSamples}
                subtitle="Distribution across the five curated cancer cohorts."
                entries={sampleRingEntries}
              />
              <HeroRingChart
                title="Data files"
                total={totalFiles}
                subtitle="Imported cohort-level mutation and analysis files."
                entries={fileRingEntries}
              />
            </div>

            <div className="gdc-overview-legend" aria-label="Cohort legend">
              {ringEntries.map((entry) => (
                <span key={entry.id} className="gdc-legend-chip">
                  <i style={{ "--legend-color": entry.color } as CSSProperties} />
                  {entry.label}
                </span>
              ))}
            </div>

            <div className="gdc-search-dock">
              <div className="gdc-search-dock-head">
                <h2>Search the database</h2>
                <p>Jump directly to a gene-level query without leaving the hero.</p>
              </div>

              <form className="gdc-hero-search" onSubmit={handleSearch}>
                <div className="gdc-search-fields">
                  <label className="gdc-search-field">
                    <span>Cohort</span>
                    <select name="cancer" defaultValue={DEFAULT_CANCER}>
                      {CANCER_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </label>
                  <label className="gdc-search-field">
                    <span>Gene Symbol</span>
                    <input name="gene" type="text" defaultValue={DEFAULT_GENE} placeholder="TP53, KRAS, EGFR" />
                  </label>
                </div>
                <div className="gdc-search-actions">
                  <button type="submit" className="gdc-search-submit">Search</button>
                  <Link to="/gene-search" className="gdc-search-link">Advanced search</Link>
                </div>
              </form>

              <div className="gdc-search-shortcuts" aria-label="Quick queries">
                {HERO_QUICK_LINKS.map((item) => (
                  <Link
                    key={item.label}
                    to={`/gene-search?source=cfDNA&cancer=${encodeURIComponent(item.cancer)}&gene=${encodeURIComponent(item.gene)}`}
                    className="gdc-search-shortcut"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
