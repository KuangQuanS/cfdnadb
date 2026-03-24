import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getOverview, getVisualizationSummary } from "../api/client";
import { ChartCard } from "../components/ChartCard";
import { HeroCarousel } from "../components/HeroCarousel";
import { SectionHeader } from "../components/SectionHeader";
import { StatGrid } from "../components/StatGrid";
import { formatNumber } from "../utils/format";

export function HomePage() {
  const overviewQuery = useQuery({ queryKey: ["overview"], queryFn: getOverview });
  const visualizationQuery = useQuery({ queryKey: ["visualization-summary"], queryFn: getVisualizationSummary });

  const overview = overviewQuery.data;
  const visualization = visualizationQuery.data;

  return (
    <>
      <HeroCarousel />
      <div className="page-stack">
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

        <section className="detail-card callout-card">
          <p className="section-eyebrow">VCF-oriented extension</p>
          <h3>Server-side VCF folders can be represented as dataset manifests before real parsing is implemented.</h3>
          <p>
            A new demo page shows the intended structure for dataset registration, per-folder metadata, normalized variant records and placeholder ingestion status.
          </p>
          <Link to="/vcf-demo" className="button-secondary inline-button">Review the VCF placeholder workflow</Link>
        </section>

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
                series: [{ type: "bar", data: visualization.publicationTrend.map((item) => item.count), itemStyle: { color: "#0F4C81" } }],
                tooltip: { trigger: "axis" }
              }}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
