import { useQuery } from "@tanstack/react-query";
import { getVisualizationSummary } from "../api/client";
import { ChartCard } from "../components/ChartCard";
import { SectionHeader } from "../components/SectionHeader";

export function VisualizationsPage() {
  const summaryQuery = useQuery({ queryKey: ["visualization-summary"], queryFn: getVisualizationSummary });

  if (!summaryQuery.data) {
    return <p className="panel-note">Loading visualizations...</p>;
  }

  const summary = summaryQuery.data;

  return (
    <div className="page-stack">
      <SectionHeader
        eyebrow="Visualizations"
        title="Database-level summary plots"
        description="Compact overview figures for disease coverage, technologies, marker categories and publication history."
      />
      <div className="chart-grid two-up">
        <ChartCard
          title="Disease coverage"
          option={{ xAxis: { type: "category", data: summary.diseaseDistribution.map((item) => item.label) }, yAxis: { type: "value" }, series: [{ type: "bar", data: summary.diseaseDistribution.map((item) => item.count), itemStyle: { color: "#355c7d" } }] }}
        />
        <ChartCard
          title="Technology distribution"
          option={{ series: [{ type: "pie", radius: "65%", data: summary.technologyDistribution.map((item) => ({ name: item.label, value: item.count })) }] }}
        />
        <ChartCard
          title="Marker-type distribution"
          option={{ xAxis: { type: "category", data: summary.markerTypeDistribution.map((item) => item.label) }, yAxis: { type: "value" }, series: [{ type: "bar", data: summary.markerTypeDistribution.map((item) => item.count), itemStyle: { color: "#6c7a89" } }] }}
        />
        <ChartCard
          title="Publication trend"
          option={{ xAxis: { type: "category", data: summary.publicationTrend.map((item) => item.year) }, yAxis: { type: "value" }, series: [{ type: "line", smooth: true, data: summary.publicationTrend.map((item) => item.count), itemStyle: { color: "#a67c52" } }] }}
        />
      </div>
    </div>
  );
}
