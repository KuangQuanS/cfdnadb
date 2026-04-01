import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getCancerSummary, getDatabaseStats } from "../api/client";
import type { CancerSummary, DatabaseStats } from "../types/api";
import { formatNumber } from "../utils/format";
import heroBg from "../assets/slider1.png";
import humanBodyImg from "../assets/human_body.png";

/* ---- Mock / fallback data when backend is unreachable ---- */
const MOCK_STATS: DatabaseStats = {
  totalVariants: 3_324_495,
  totalSamples: 1_527,
  totalGenes: 22_638,
  cohortCount: 5
};

const MOCK_COHORTS: CancerSummary[] = [
  { cancer: "Breast", sampleCount: 486, totalDataFiles: 972, avinputCount: 486, filteredCount: 486, annotatedCount: 486, somaticCount: 0, plotAssetCount: 12, externalAssetCount: 8, rawImportStatus: "Completed", filteredStatus: "Completed", annotatedStatus: "Completed", somaticStatus: "Not started", plotStatus: "Completed", externalStatus: "Completed" },
  { cancer: "Colonrector", sampleCount: 352, totalDataFiles: 704, avinputCount: 352, filteredCount: 352, annotatedCount: 352, somaticCount: 0, plotAssetCount: 10, externalAssetCount: 6, rawImportStatus: "Completed", filteredStatus: "Completed", annotatedStatus: "Completed", somaticStatus: "Not started", plotStatus: "Completed", externalStatus: "Completed" },
  { cancer: "Liver", sampleCount: 278, totalDataFiles: 556, avinputCount: 278, filteredCount: 278, annotatedCount: 278, somaticCount: 0, plotAssetCount: 8, externalAssetCount: 4, rawImportStatus: "Completed", filteredStatus: "Completed", annotatedStatus: "Completed", somaticStatus: "Not started", plotStatus: "Completed", externalStatus: "Completed" },
  { cancer: "Lung", sampleCount: 312, totalDataFiles: 624, avinputCount: 312, filteredCount: 312, annotatedCount: 312, somaticCount: 0, plotAssetCount: 9, externalAssetCount: 5, rawImportStatus: "Completed", filteredStatus: "Completed", annotatedStatus: "Completed", somaticStatus: "Not started", plotStatus: "Completed", externalStatus: "Completed" },
  { cancer: "Pdac", sampleCount: 99, totalDataFiles: 198, avinputCount: 99, filteredCount: 99, annotatedCount: 99, somaticCount: 0, plotAssetCount: 5, externalAssetCount: 3, rawImportStatus: "Completed", filteredStatus: "Completed", annotatedStatus: "Completed", somaticStatus: "Not started", plotStatus: "Completed", externalStatus: "Completed" }
];

/* ---- Cohort visual config ---- */
const COHORT_COLORS: Record<string, string> = {
  Breast: "#E53E3E", Colonrector: "#FC812F", Liver: "#38A169", Lung: "#3182CE", Pdac: "#805AD5"
};
const COHORT_LABELS: Record<string, string> = {
  Breast: "Breast", Colonrector: "Colorectal", Liver: "Liver", Lung: "Lung", Pdac: "Pancreas"
};

export function HeroCarousel() {
  const statsQuery = useQuery({ queryKey: ["db-stats"], queryFn: getDatabaseStats, staleTime: 5 * 60_000 });
  const cancerQuery = useQuery({ queryKey: ["cancer-summary"], queryFn: getCancerSummary, staleTime: 5 * 60_000 });

  const stats = statsQuery.data ?? MOCK_STATS;
  const cohorts = cancerQuery.data && cancerQuery.data.length > 0 ? cancerQuery.data : MOCK_COHORTS;
  const maxSamples = Math.max(...cohorts.map((c) => c.sampleCount), 1);

  return (
    <div className="portal-hero">
      <div className="portal-hero-bg" style={{ backgroundImage: `url(${heroBg})` }} />
      <div className="portal-hero-container">

        {/* ---- Left column ---- */}
        <div className="portal-hero-left">
          <h1 className="portal-hero-title">
            <span className="portal-hero-title-main">cfDNA Database</span>
            <span className="portal-hero-title-sub">Data Portal</span>
          </h1>

          <div className="portal-hero-section">
            <h2 className="portal-hero-h2">Cell-free DNA Somatic Variant Atlas</h2>
            <p className="portal-hero-desc">
              A repository and computational platform for cancer researchers who
              need to explore somatic mutations identified from plasma cell-free
              DNA across multiple cancer cohorts.
            </p>
            <Link to="/browse" className="button-primary portal-hero-cta">
              Explore Variant Database
            </Link>
          </div>

          <div className="portal-hero-section">
            <h2 className="portal-hero-h2">Data Portal Summary</h2>
            <div className="portal-stats-bar">
              {[
                { icon: "cohort", label: "Cohorts", value: String(stats.cohortCount) },
                { icon: "sample", label: "Samples", value: formatNumber(stats.totalSamples) },
                { icon: "variant", label: "Variants", value: formatNumber(stats.totalVariants) },
                { icon: "gene", label: "Genes", value: formatNumber(stats.totalGenes) }
              ].map((s) => (
                <div key={s.label} className="portal-stat-item">
                  <PortalIcon type={s.icon} />
                  <strong>{s.value}</strong>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ---- Center column — anatomical body ---- */}
        <div className="portal-hero-center">
          <BodySilhouette cohorts={cohorts} />
        </div>

        {/* ---- Right column — bar chart ---- */}
        <div className="portal-hero-right">
          <h3 className="portal-chart-title">Samples by Cancer Cohort</h3>
          <div className="portal-bar-chart">
            {cohorts.map((c) => {
              const pct = (c.sampleCount / maxSamples) * 100;
              const color = COHORT_COLORS[c.cancer] ?? "#999";
              return (
                <div key={c.cancer} className="portal-bar-row">
                  <span className="portal-bar-label">{COHORT_LABELS[c.cancer] ?? c.cancer}</span>
                  <div className="portal-bar-track">
                    <div className="portal-bar-fill" style={{ width: `${Math.max(pct, 4)}%`, background: color }} />
                  </div>
                  <span className="portal-bar-value">{formatNumber(c.sampleCount)}</span>
                </div>
              );
            })}
          </div>

          <h3 className="portal-chart-title" style={{ marginTop: 32 }}>Processing Status</h3>
          <div className="portal-status-grid">
            {cohorts.map((c) => (
              <div key={c.cancer} className="portal-status-row">
                <span className="portal-status-dot" style={{ background: COHORT_COLORS[c.cancer] }} />
                <span className="portal-status-name">{COHORT_LABELS[c.cancer] ?? c.cancer}</span>
                <span className={`portal-status-badge ${c.annotatedStatus === "Completed" ? "complete" : "pending"}`}>
                  {c.annotatedStatus === "Completed" ? "Annotated" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Anatomical body image with cohort label overlay
   ============================================================ */
function BodySilhouette({ cohorts }: { cohorts: CancerSummary[] }) {
  const cohortSet = new Set(cohorts.map((c) => c.cancer));

  const labels: { cancer: string; label: string; top: string; left: string; lineAngle: "left" | "right" }[] = [
    { cancer: "Lung", label: "Lung", top: "22%", left: "78%", lineAngle: "right" },
    { cancer: "Breast", label: "Breast", top: "28%", left: "8%", lineAngle: "left" },
    { cancer: "Liver", label: "Liver", top: "38%", left: "78%", lineAngle: "right" },
    { cancer: "Pdac", label: "Pancreas", top: "44%", left: "8%", lineAngle: "left" },
    { cancer: "Colonrector", label: "Colorectal", top: "52%", left: "78%", lineAngle: "right" },
  ];

  return (
    <div className="portal-body-wrapper">
      <img src={humanBodyImg} alt="Human body anatomy" className="portal-body-img" />
      <div className="portal-body-labels">
        {labels.map((l) => {
          const active = cohortSet.has(l.cancer);
          const color = COHORT_COLORS[l.cancer] ?? "#999";
          return (
            <span
              key={l.cancer}
              className={`portal-body-label ${active ? "active" : ""}`}
              style={{
                top: l.top,
                left: l.left,
                borderColor: color,
                color: active ? "#fff" : "rgba(255,255,255,0.5)",
                background: active ? color : "rgba(0,0,0,0.35)",
              }}
            >
              {l.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   Icons for the stats bar
   ============================================================ */
function PortalIcon({ type }: { type: string }) {
  const style = { width: 32, height: 32, opacity: 0.8 };
  switch (type) {
    case "cohort":
      return (
        <svg {...style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "sample":
      return (
        <svg {...style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "variant":
      return (
        <svg {...style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case "gene":
      return (
        <svg {...style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" /><path d="M8 12h8M12 8v8" />
        </svg>
      );
    default:
      return null;
  }
}
