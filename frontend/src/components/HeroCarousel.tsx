import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getCancerSummary, getDatabaseStats } from "../api/client";
import type { CancerSummary, DatabaseStats } from "../types/api";
import { formatNumber } from "../utils/format";
import humanBodyImg from "../assets/human_body.png";
import "../styles/home.css";

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
    <section className="gdc-hero">
      <div className="gdc-hero-background"></div>
      <div className="gdc-hero-inner">
        
        {/* Left Column */}
        <div className="gdc-col-left">
          <h1 className="gdc-title">cfDNA Somatic Variant<br/><span>Data Portal</span></h1>
          <div className="gdc-subtitle-section">
            <h3>Harmonized Cancer Datasets</h3>
            <p>
              A repository and computational platform for cancer researchers who need to 
              understand cancer, its clinical progression, and response to therapy through plasma cell-free DNA.
            </p>
            <Link to="/gene-search" className="gdc-btn-primary">Explore Our Cancer Datasets</Link>
          </div>
          
          <div className="gdc-summary-section">
            <div className="gdc-summary-header">
              <h3>Data Portal Summary</h3>
              <span className="gdc-release-link">Data Release 1.0 - Dec 2025</span>
            </div>
            <div className="gdc-metrics-pill">
              <div className="gdc-metric">
                 <div className="gdc-metric-icon cohort-icon"></div>
                 <span className="gdc-num">{stats.cohortCount}</span>
                 <span className="gdc-label">Cohorts</span>
              </div>
              <div className="gdc-metric">
                 <div className="gdc-metric-icon site-icon"></div>
                 <span className="gdc-num">{formatNumber(stats.totalSamples)}</span>
                 <span className="gdc-label">Samples</span>
              </div>
              <div className="gdc-metric">
                 <div className="gdc-metric-icon gene-icon"></div>
                 <span className="gdc-num">{formatNumber(stats.totalGenes)}</span>
                 <span className="gdc-label">Genes</span>
              </div>
              <div className="gdc-metric">
                 <div className="gdc-metric-icon variant-icon"></div>
                 <span className="gdc-num">{formatNumber(stats.totalVariants)}</span>
                 <span className="gdc-label">Mutations</span>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Column */}
        <div className="gdc-col-middle">
          <BodySilhouette cohorts={cohorts} />
        </div>

        {/* Right Column */}
        <div className="gdc-col-right">
          <div className="gdc-chart-container">
            <h4 className="gdc-chart-title">Cases by Major Primary Site</h4>
            <div className="gdc-bar-chart">
              {cohorts.map((c) => {
                const pct = (c.sampleCount / maxSamples) * 100;
                return (
                  <div key={c.cancer} className="gdc-bar-row">
                    <span className="gdc-bar-label">{COHORT_LABELS[c.cancer] ?? c.cancer}</span>
                    <div className="gdc-bar-track">
                      <div 
                        className={`gdc-bar-fill color-${c.cancer.toLowerCase()}`}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="gdc-chart-axis">
              <span>0</span>
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>100s of Cases</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

function BodySilhouette({ cohorts }: { cohorts: CancerSummary[] }) {
  const cohortSet = new Set(cohorts.map((c) => c.cancer));

  const labels = [
    { cancer: "Lung", label: "Lung", labelTop: "27%", labelLeft: "90%", pointTop: "28%", pointLeft: "55%" },
    { cancer: "Breast", label: "Breast", labelTop: "33%", labelLeft: "10%", pointTop: "33%", pointLeft: "42%" },
    { cancer: "Liver", label: "Liver", labelTop: "44%", labelLeft: "90%", pointTop: "42%", pointLeft: "48%" },
    { cancer: "Pdac", label: "Pancreas", labelTop: "50%", labelLeft: "10%", pointTop: "50%", pointLeft: "52%" },
    { cancer: "Colonrector", label: "Colorectal", labelTop: "58%", labelLeft: "90%", pointTop: "56%", pointLeft: "48%" },
  ];

  return (
    <div className="gdc-body-wrapper">
      <img src={humanBodyImg} alt="Human body" className="gdc-body-img" />
      <svg className="gdc-body-svg" xmlns="http://www.w3.org/2000/svg">
        {labels.map((l) => {
          const active = cohortSet.has(l.cancer);
          if (!active) return null;
          return (
            <line 
              key={`line-${l.cancer}`}
              x1={l.labelLeft} y1={l.labelTop} 
              x2={l.pointLeft} y2={l.pointTop} 
            />
          );
        })}
      </svg>
      {labels.map((l) => {
        const active = cohortSet.has(l.cancer);
        if (!active) return null;
        return (
          <div key={l.cancer}>
             <div className="gdc-body-label" style={{ top: l.labelTop, left: l.labelLeft }}>{l.label}</div>
             <div className="gdc-body-point" style={{ top: l.pointTop, left: l.pointLeft }}></div>
          </div>
        );
      })}
    </div>
  );
}
