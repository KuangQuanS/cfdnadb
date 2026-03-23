import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

interface ChartCardProps {
  title: string;
  option: EChartsOption;
}

export function ChartCard({ title, option }: ChartCardProps) {
  return (
    <article className="chart-card">
      <h3>{title}</h3>
      <ReactECharts option={option} style={{ height: 320 }} />
    </article>
  );
}
