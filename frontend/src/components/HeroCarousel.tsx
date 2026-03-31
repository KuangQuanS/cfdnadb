import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getCancerSummary, getDatabaseStats } from "../api/client";
import { formatNumber } from "../utils/format";

/* Cohort colors matching the bar chart */
const COHORT_COLORS: Record<string, string> = {
  Breast: "#E53E3E",
  Colonrector: "#FC812F",
  Liver: "#38A169",
  Lung: "#3182CE",
  Pdac: "#805AD5"
};

const COHORT_LABELS: Record<string, string> = {
  Breast: "Breast",
  Colonrector: "Colorectal",
  Liver: "Liver",
  Lung: "Lung",
  Pdac: "Pancreas"
};

/* SVG organ highlight positions (cx, cy relative to body center) */
const ORGAN_HIGHLIGHTS: Record<string, { cx: number; cy: number; rx: number; ry: number }> = {
  Breast: { cx: 0, cy: -42, rx: 28, ry: 16 },
  Lung: { cx: 0, cy: -62, rx: 24, ry: 20 },
  Liver: { cx: 18, cy: -30, rx: 16, ry: 12 },
  Colonrector: { cx: 0, cy: 8, rx: 22, ry: 22 },
  Pdac: { cx: -8, cy: -18, rx: 12, ry: 8 }
};

export function HeroCarousel() {
  const statsQuery = useQuery({ queryKey: ["db-stats"], queryFn: getDatabaseStats, staleTime: 5 * 60_000 });
  const cancerQuery = useQuery({ queryKey: ["cancer-summary"], queryFn: getCancerSummary, staleTime: 5 * 60_000 });

  const stats = statsQuery.data;
  const cohorts = cancerQuery.data ?? [];
  const maxSamples = Math.max(...cohorts.map((c) => c.sampleCount), 1);

  return (
    <div className="portal-hero">
      <div className="portal-hero-bg" />
      <div className="portal-hero-container">

        {/* Left column — text + CTA */}
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
                { icon: "cohort", label: "Cohorts", value: stats ? String(stats.cohortCount) : "—" },
                { icon: "sample", label: "Samples", value: stats ? formatNumber(stats.totalSamples) : "—" },
                { icon: "variant", label: "Variants", value: stats ? formatNumber(stats.totalVariants) : "—" },
                { icon: "gene", label: "Genes", value: stats ? formatNumber(stats.totalGenes) : "—" }
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

        {/* Center column — body silhouette */}
        <div className="portal-hero-center">
          <svg viewBox="0 0 180 380" className="portal-body-svg">
            {/* Head */}
            <circle cx="90" cy="32" r="24" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
            {/* Neck */}
            <rect x="82" y="56" width="16" height="14" rx="4" fill="rgba(255,255,255,0.08)" />
            {/* Torso */}
            <path d="M55 70 Q52 70 48 80 L38 130 Q36 145 42 160 L48 180 Q50 190 55 200 L60 220 Q65 240 68 260 L72 280 Q74 290 76 300 L80 340 Q82 355 88 360 L92 360 Q98 355 100 340 L104 300 Q106 290 108 280 L112 260 Q115 240 120 220 L125 200 Q130 190 132 180 L138 160 Q144 145 142 130 L132 80 Q128 70 125 70 Z"
              fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
            {/* Arms */}
            <path d="M48 80 Q35 85 25 110 L18 140 Q14 155 16 165 L22 175" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="6" strokeLinecap="round" />
            <path d="M132 80 Q145 85 155 110 L162 140 Q166 155 164 165 L158 175" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="6" strokeLinecap="round" />
            {/* Organ highlights */}
            {cohorts.map((c) => {
              const pos = ORGAN_HIGHLIGHTS[c.cancer];
              if (!pos) return null;
              return (
                <ellipse
                  key={c.cancer}
                  cx={90 + pos.cx}
                  cy={160 + pos.cy}
                  rx={pos.rx}
                  ry={pos.ry}
                  fill={COHORT_COLORS[c.cancer] ?? "#fff"}
                  opacity={0.55}
                  stroke={COHORT_COLORS[c.cancer] ?? "#fff"}
                  strokeWidth="1.5"
                />
              );
            })}
            {/* Organ labels */}
            {cohorts.map((c) => {
              const pos = ORGAN_HIGHLIGHTS[c.cancer];
              if (!pos) return null;
              return (
                <text
                  key={c.cancer + "-label"}
                  x={90 + pos.cx}
                  y={160 + pos.cy + 4}
                  textAnchor="middle"
                  fill="white"
                  fontSize="8"
                  fontWeight="700"
                >
                  {COHORT_LABELS[c.cancer]?.[0]}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Right column — cohort bar chart */}
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
                    <div className="portal-bar-fill" style={{ width: `${Math.max(pct, 3)}%`, background: color }} />
                  </div>
                  <span className="portal-bar-value">{formatNumber(c.sampleCount)}</span>
                </div>
              );
            })}
          </div>

          <h3 className="portal-chart-title" style={{ marginTop: 28 }}>Processing Status</h3>
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

/* Small icon set for the stats bar */
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
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
          <path d="M8 12h8M12 8v8" />
        </svg>
      );
    default:
      return null;
  }
}
