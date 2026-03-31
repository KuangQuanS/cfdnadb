import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getCancerSummary, getDatabaseStats } from "../api/client";
import type { CancerSummary, DatabaseStats } from "../types/api";
import { formatNumber } from "../utils/format";
import heroBg from "../assets/slider1.png";

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
   Detailed anatomical body silhouette SVG
   ============================================================ */
function BodySilhouette({ cohorts }: { cohorts: CancerSummary[] }) {
  const cohortSet = new Set(cohorts.map((c) => c.cancer));
  const hl = (cancer: string) => cohortSet.has(cancer) ? 0.7 : 0;

  return (
    <svg viewBox="0 0 240 520" className="portal-body-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Head */}
      <ellipse cx="120" cy="42" rx="28" ry="34" fill="url(#bodyGrad)" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" />
      {/* Ears */}
      <ellipse cx="90" cy="42" rx="5" ry="10" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
      <ellipse cx="150" cy="42" rx="5" ry="10" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
      {/* Neck */}
      <rect x="108" y="74" width="24" height="20" rx="8" fill="url(#bodyGrad)" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />

      {/* Torso outline */}
      <path d="
        M 78 94
        Q 68 96 60 108
        L 52 140
        Q 48 160 50 180
        L 52 210
        Q 54 235 58 260
        L 62 285
        Q 64 295 70 300
        L 82 305
        Q 100 310 120 312
        Q 140 310 158 305
        L 170 300
        Q 176 295 178 285
        L 182 260
        Q 186 235 188 210
        L 190 180
        Q 192 160 188 140
        L 180 108
        Q 172 96 162 94
        Z
      " fill="url(#bodyGrad)" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" />

      {/* Shoulders */}
      <path d="M 78 94 Q 60 94 42 106 L 30 120" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" />
      <path d="M 162 94 Q 180 94 198 106 L 210 120" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" />

      {/* Left arm */}
      <path d="M 30 120 Q 22 140 18 165 L 14 195 Q 10 220 12 240 L 16 260 Q 18 270 22 275"
        fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="8" strokeLinecap="round" />
      <ellipse cx="22" cy="280" rx="8" ry="10" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />

      {/* Right arm */}
      <path d="M 210 120 Q 218 140 222 165 L 226 195 Q 230 220 228 240 L 224 260 Q 222 270 218 275"
        fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="8" strokeLinecap="round" />
      <ellipse cx="218" cy="280" rx="8" ry="10" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />

      {/* Left leg */}
      <path d="M 100 312 Q 95 340 90 380 L 86 420 Q 84 450 82 470 L 80 495"
        fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="10" strokeLinecap="round" />
      <ellipse cx="78" cy="502" rx="12" ry="6" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />

      {/* Right leg */}
      <path d="M 140 312 Q 145 340 150 380 L 154 420 Q 156 450 158 470 L 160 495"
        fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="10" strokeLinecap="round" />
      <ellipse cx="162" cy="502" rx="12" ry="6" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />

      {/* ---- Internal organs ---- */}
      {/* Lungs */}
      <g filter={hl("Lung") ? "url(#glow)" : undefined} opacity={hl("Lung") || 0.2}>
        {/* Left lung */}
        <path d="M 82 115 Q 72 120 68 140 L 66 165 Q 65 180 70 185 L 80 188 Q 95 190 105 185 L 108 175 Q 110 155 108 135 L 105 120 Q 100 112 90 112 Z"
          fill={COHORT_COLORS.Lung} opacity={0.5} stroke={COHORT_COLORS.Lung} strokeWidth="1" />
        {/* Right lung */}
        <path d="M 158 115 Q 168 120 172 140 L 174 165 Q 175 180 170 185 L 160 188 Q 145 190 135 185 L 132 175 Q 130 155 132 135 L 135 120 Q 140 112 150 112 Z"
          fill={COHORT_COLORS.Lung} opacity={0.5} stroke={COHORT_COLORS.Lung} strokeWidth="1" />
      </g>

      {/* Breast area */}
      <g filter={hl("Breast") ? "url(#glow)" : undefined} opacity={hl("Breast") || 0.15}>
        <ellipse cx="100" cy="155" rx="14" ry="12" fill={COHORT_COLORS.Breast} opacity={0.55} stroke={COHORT_COLORS.Breast} strokeWidth="1" />
        <ellipse cx="140" cy="155" rx="14" ry="12" fill={COHORT_COLORS.Breast} opacity={0.55} stroke={COHORT_COLORS.Breast} strokeWidth="1" />
      </g>

      {/* Liver */}
      <g filter={hl("Liver") ? "url(#glow)" : undefined} opacity={hl("Liver") || 0.15}>
        <path d="M 130 185 Q 145 183 160 188 L 168 195 Q 172 205 168 215 L 155 220 Q 140 222 130 218 L 125 210 Q 122 198 125 190 Z"
          fill={COHORT_COLORS.Liver} opacity={0.55} stroke={COHORT_COLORS.Liver} strokeWidth="1" />
      </g>

      {/* Pancreas */}
      <g filter={hl("Pdac") ? "url(#glow)" : undefined} opacity={hl("Pdac") || 0.15}>
        <ellipse cx="120" cy="225" rx="28" ry="8" fill={COHORT_COLORS.Pdac} opacity={0.55} stroke={COHORT_COLORS.Pdac} strokeWidth="1" />
      </g>

      {/* Colorectal (large intestine path) */}
      <g filter={hl("Colonrector") ? "url(#glow)" : undefined} opacity={hl("Colonrector") || 0.15}>
        <path d="M 88 240 L 85 260 Q 83 275 88 285 L 100 290 Q 115 293 130 290 L 148 285 Q 155 275 152 260 L 148 245 Q 144 238 135 240 L 120 248 Q 108 252 100 248 L 92 243 Z"
          fill={COHORT_COLORS.Colonrector} opacity={0.45} stroke={COHORT_COLORS.Colonrector} strokeWidth="1" />
      </g>

      {/* ---- Organ labels (pointing lines + text) ---- */}
      <g fontSize="11" fontWeight="700" fill="white">
        {/* Lung label */}
        <line x1="175" y1="140" x2="198" y2="128" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
        <text x="200" y="132" fill="rgba(255,255,255,0.85)">Lung</text>

        {/* Breast label */}
        <line x1="85" y1="152" x2="52" y2="145" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
        <text x="22" y="149" fill="rgba(255,255,255,0.85)">Breast</text>

        {/* Liver label */}
        <line x1="170" y1="205" x2="195" y2="198" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
        <text x="197" y="202" fill="rgba(255,255,255,0.85)">Liver</text>

        {/* Pancreas label */}
        <line x1="92" y1="225" x2="48" y2="225" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
        <text x="14" y="229" fill="rgba(255,255,255,0.85)">Pancreas</text>

        {/* Colorectal label */}
        <line x1="155" y1="270" x2="192" y2="268" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
        <text x="194" y="272" fill="rgba(255,255,255,0.85)">Colorectal</text>
      </g>
    </svg>
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
