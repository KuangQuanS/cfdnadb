import { type FormEvent, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { getCancerSummary, getDatabaseStats } from "../api/client";
import { CANCER_OPTIONS, DEFAULT_CANCER, DEFAULT_GENE } from "../constants/cfdna";
import type { CancerSummary, DatabaseStats } from "../types/api";
import { formatNumber } from "../utils/format";
import humanBodyImg from "../assets/human_body.png";
import "../styles/home.css";

const MOCK_STATS: DatabaseStats = {
  totalVariants: 3_324_495,
  totalSamples: 1_527,
  totalGenes: 22_638,
  cohortCount: 12
};

const MOCK_COHORTS: CancerSummary[] = [
  { cancer: "Breast", sampleCount: 486, totalDataFiles: 972, avinputCount: 486, filteredCount: 486, annotatedCount: 486, somaticCount: 0, plotAssetCount: 12, externalAssetCount: 8, rawImportStatus: "Completed", filteredStatus: "Completed", annotatedStatus: "Completed", somaticStatus: "Not started", plotStatus: "Completed", externalStatus: "Completed" },
  { cancer: "Colonrector", sampleCount: 352, totalDataFiles: 704, avinputCount: 352, filteredCount: 352, annotatedCount: 352, somaticCount: 0, plotAssetCount: 10, externalAssetCount: 6, rawImportStatus: "Completed", filteredStatus: "Completed", annotatedStatus: "Completed", somaticStatus: "Not started", plotStatus: "Completed", externalStatus: "Completed" },
  { cancer: "Liver", sampleCount: 278, totalDataFiles: 556, avinputCount: 278, filteredCount: 278, annotatedCount: 278, somaticCount: 0, plotAssetCount: 8, externalAssetCount: 4, rawImportStatus: "Completed", filteredStatus: "Completed", annotatedStatus: "Completed", somaticStatus: "Not started", plotStatus: "Completed", externalStatus: "Completed" },
  { cancer: "Lung", sampleCount: 312, totalDataFiles: 624, avinputCount: 312, filteredCount: 312, annotatedCount: 312, somaticCount: 0, plotAssetCount: 9, externalAssetCount: 5, rawImportStatus: "Completed", filteredStatus: "Completed", annotatedStatus: "Completed", somaticStatus: "Not started", plotStatus: "Completed", externalStatus: "Completed" },
  { cancer: "Pdac", sampleCount: 99, totalDataFiles: 198, avinputCount: 99, filteredCount: 99, annotatedCount: 99, somaticCount: 0, plotAssetCount: 5, externalAssetCount: 3, rawImportStatus: "Completed", filteredStatus: "Completed", annotatedStatus: "Completed", somaticStatus: "Not started", plotStatus: "Completed", externalStatus: "Completed" }
];

const COHORT_LABELS: Record<string, string> = {
  Breast: "Breast",
  Colonrector: "Colorectal",
  Liver: "Liver",
  Lung: "Lung",
  Pdac: "Pancreas",
};

const BAR_COLORS = ["#4b359a", "#5b43ad", "#6b53bc", "#7b64cb", "#917dd8"];
const BROWSE_CANCER_MAP: Record<string, string> = {
  Breast: "Breast",
  Colonrector: "Colorectal",
  Liver: "Liver",
  Lung: "Lung",
  Pdac: "Pancreatic",
};

export function HeroCarousel() {
  const navigate = useNavigate();
  const statsQuery = useQuery({ queryKey: ["db-stats"], queryFn: getDatabaseStats, staleTime: 5 * 60_000 });
  const cancerQuery = useQuery({ queryKey: ["cancer-summary"], queryFn: getCancerSummary, staleTime: 5 * 60_000 });

  const stats = statsQuery.data ?? MOCK_STATS;
  const cohorts = cancerQuery.data && cancerQuery.data.length > 0 ? cancerQuery.data : MOCK_COHORTS;

  const topCohorts = useMemo(
    () => [...cohorts].sort((left, right) => right.sampleCount - left.sampleCount).slice(0, 5),
    [cohorts]
  );
  const maxSamples = Math.max(...topCohorts.map((item) => item.sampleCount), 1);
  const totalSamples = stats.totalSamples || topCohorts.reduce((sum, item) => sum + item.sampleCount, 0);
  const axisTicks = buildAxisTicks(maxSamples);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const cancer = formData.get("cancer")?.toString() || DEFAULT_CANCER;
    const gene = formData.get("gene")?.toString().trim() || DEFAULT_GENE;
    navigate(`/gene-search?source=cfDNA&cancer=${encodeURIComponent(cancer)}&gene=${encodeURIComponent(gene)}`);
  };

  const goToBrowse = (cancer: string) => {
    const targetCancer = BROWSE_CANCER_MAP[cancer] ?? cancer;
    navigate(`/browse?cancer=${encodeURIComponent(targetCancer)}`);
  };

  return (
    <section className="gdc-hero">
      <div className="gdc-hero-inner">
        <div className="gdc-col-left">
          <h1 className="gdc-title">
            cfDNA cancer database
          </h1>
          <p className="gdc-subtitle">
            Curated plasma cfDNA somatic mutation records with cohort browse, gene-level query, and downloadable data outputs.
          </p>

          <form className="gdc-hero-search" onSubmit={handleSearch}>
            <div className="gdc-search-fields">
              <label className="gdc-search-field gdc-search-field--cohort">
                <span>Cohort</span>
                <select name="cancer" defaultValue={DEFAULT_CANCER}>
                  {CANCER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="gdc-search-field gdc-search-field--gene">
                <span>Gene Symbol</span>
                <input name="gene" type="text" defaultValue={DEFAULT_GENE} placeholder="TP53, KRAS, EGFR" />
              </label>
            </div>
            <div className="gdc-search-actions">
              <button type="submit" className="gdc-search-submit">Search</button>
              <Link to="/gene-search" className="gdc-search-link">Advanced search</Link>
            </div>
          </form>
        </div>

        <div className="gdc-col-middle" aria-hidden="true">
          <div className="gdc-body-card">
            <img src={humanBodyImg} alt="" className="gdc-body-img" />
          </div>
        </div>

        <div className="gdc-col-right">
          <section className="gdc-chart-card">
            <div className="gdc-chart-header">
              <h3>Cases by Primary Site</h3>
              <span>n = {formatNumber(totalSamples)}</span>
            </div>

            <div className="gdc-bar-chart">
              {topCohorts.map((cohort, index) => {
                const width = (cohort.sampleCount / maxSamples) * 100;
                return (
                  <button
                    key={cohort.cancer}
                    type="button"
                    className="gdc-bar-row"
                    onClick={() => goToBrowse(cohort.cancer)}
                    aria-label={`Open browse view for ${COHORT_LABELS[cohort.cancer] ?? cohort.cancer}`}
                  >
                    <div className="gdc-bar-meta">
                      <span className="gdc-bar-label">{COHORT_LABELS[cohort.cancer] ?? cohort.cancer}</span>
                      <span className="gdc-bar-value">{formatNumber(cohort.sampleCount)}</span>
                    </div>
                    <div className="gdc-bar-track">
                      <div
                        className="gdc-bar-fill"
                        style={{
                          width: `${Math.max(width, 2)}%`,
                          backgroundColor: BAR_COLORS[index % BAR_COLORS.length],
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="gdc-chart-axis">
              {axisTicks.map((tick) => (
                <span key={tick}>{formatAxisTick(tick, axisTicks[axisTicks.length - 1] ?? tick)}</span>
              ))}
            </div>

            <div className="gdc-summary-section">
              <div className="gdc-summary-header">
                <h4>Database Summary</h4>
              </div>
              <div className="gdc-summary-grid">
                <SummaryMetric label="Cohorts" value={formatNumber(stats.cohortCount)} />
                <SummaryMetric label="Samples" value={formatNumber(stats.totalSamples)} />
                <SummaryMetric label="Genes" value={formatNumber(stats.totalGenes)} />
                <SummaryMetric label="Mutations" value={stats.totalVariants >= 1_000_000 ? `${(stats.totalVariants / 1_000_000).toFixed(1)}M+` : formatNumber(stats.totalVariants)} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="gdc-metric">
      <span className="gdc-label">{label}</span>
      <strong className="gdc-num">{value}</strong>
    </div>
  );
}

function buildAxisTicks(maxValue: number) {
  const roundedMax = Math.max(100, Math.ceil(maxValue / 100) * 100);
  const step = roundedMax / 4;
  return [0, step, step * 2, step * 3, roundedMax].map((value) => Math.round(value));
}

function formatAxisTick(value: number, roundedMax: number) {
  if (value === roundedMax) return `${roundedMax}+`;
  return String(value);
}
