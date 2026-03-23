import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getOverview, getVisualizationSummary } from "../api/client";
import { ChartCard } from "../components/ChartCard";
import { SectionHeader } from "../components/SectionHeader";
import { StatGrid } from "../components/StatGrid";
import { formatNumber } from "../utils/format";

export function HomePage() {
  const overviewQuery = useQuery({ queryKey: ["overview"], queryFn: getOverview });
  const visualizationQuery = useQuery({ queryKey: ["visualization-summary"], queryFn: getVisualizationSummary });

  const overview = overviewQuery.data;
  const visualization = visualizationQuery.data;

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <p className="hero-kicker">Curated liquid biopsy reference</p>
          <h1>Academic-style cfDNA database for browsing studies, markers and downloadable releases.</h1>
          <p className="hero-copy">
            The prototype emphasizes clean scientific presentation, reproducible data access, and summary visualizations suitable for a manuscript-facing database portal.
          </p>
        </div>
        <div className="hero-actions">
          <Link to="/browse" className="button-primary">Browse records</Link>
          <Link to="/downloads" className="button-secondary">Download releases</Link>
        </div>
      </section>

      <SectionHeader
        eyebrow="Overview"
        title="Database scope"
        description="High-level counts and category emphasis for the current public release."
      />
      <StatGrid
        items={[
          { label: "Studies", value: formatNumber(overview?.studyCount ?? 0) },
          { label: "Biomarkers", value: formatNumber(overview?.biomarkerCount ?? 0) },
          { label: "Datasets", value: formatNumber(overview?.datasetCount ?? 0) },
          { label: "Downloads", value: formatNumber(overview?.downloadableAssets ?? 0) }
        ]}
      />

      {visualization ? (
        <div className="chart-grid two-up">
          <ChartCard
            title="Disease distribution"
            option={{
              tooltip: { trigger: "item" },
              series: [
                {
                  type: "pie",
                  radius: ["45%", "70%"],
                  label: { formatter: "{b}: {c}" },
                  data: visualization.diseaseDistribution.map((item) => ({ name: item.label, value: item.count }))
                }
              ]
            }}
          />
          <ChartCard
            title="Publication trend"
            option={{
              xAxis: { type: "category", data: visualization.publicationTrend.map((item) => item.year) },
              yAxis: { type: "value" },
              series: [{ type: "bar", data: visualization.publicationTrend.map((item) => item.count), itemStyle: { color: "#355c7d" } }],
              tooltip: { trigger: "axis" }
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
