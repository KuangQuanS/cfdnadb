import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useNavigate } from "react-router-dom";
import { SectionHeader } from "../components/SectionHeader";
import { getStatisticsOverview } from "../api/client";
import type { CancerSummary, LabelCount } from "../types/api";
import { formatNumber } from "../utils/format";

const PURPLE_SCALE = [
  "#4b359a",
  "#5d45b4",
  "#7258c6",
  "#8a70d2",
  "#a288dd",
  "#b7a0e5",
  "#c9b7ec",
  "#dbcdf2",
];

const DONUT_SCALE = [
  "#4b359a",
  "#6548b8",
  "#7e63cb",
  "#9a83dd",
  "#b8aae9",
  "#d7d0f6",
  "#ece4ff",
];

const CHART_LOADING_OPTION = {
  text: "Loading chart...",
  color: "#7258c6",
  textColor: "#5c6b86",
  maskColor: "rgba(255, 255, 255, 0.72)",
  zlevel: 0,
  fontSize: 13,
  spinnerRadius: 12,
  lineWidth: 3,
};

function cleanLabels(items: LabelCount[]): LabelCount[] {
  return items.filter(
    (item) =>
      item.count > 0 &&
      item.label.trim() !== "" &&
      item.label.trim() !== "."
  );
}

function withOtherGroup(items: LabelCount[], limit = 6): LabelCount[] {
  const sorted = [...cleanLabels(items)].sort((a, b) => b.count - a.count);
  if (sorted.length <= limit) return sorted;
  const head = sorted.slice(0, limit);
  const tailCount = sorted
    .slice(limit)
    .reduce((sum, item) => sum + item.count, 0);
  return [...head, { label: "Other", count: tailCount }];
}

function buildCohortDonutOption(
  cancers: CancerSummary[],
  total: number
): EChartsOption {
  const normalized = withOtherGroup(
    cancers
      .filter((item) => item.sampleCount > 0)
      .map((item) => ({ label: item.cancer, count: item.sampleCount })),
    8
  );

  return {
    tooltip: {
      trigger: "item",
      formatter: (params: { name?: string; value?: number; percent?: number }) => {
        const value = params.value ?? 0;
        const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
        return `${params.name}<br/>${formatNumber(value)} samples (${pct}%)`;
      },
    },
    title: {
      text: formatNumber(total),
      subtext: "samples",
      left: "33%",
      top: "39%",
      textAlign: "center",
      textStyle: {
        color: "#1d2742",
        fontSize: 24,
        fontWeight: 800,
      },
      subtextStyle: {
        color: "#6b7893",
        fontSize: 11,
        fontWeight: 700,
      },
      itemGap: 2,
    },
    legend: {
      orient: "vertical",
      right: 10,
      top: "middle",
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 10,
      type: "scroll",
      pageIconColor: "#4b359a",
      pageTextStyle: { color: "#53627d", fontSize: 11 },
      textStyle: { color: "#53627d", fontSize: 11, fontWeight: 600 },
    },
    series: [
      {
        type: "pie",
        radius: ["52%", "72%"],
        center: ["33%", "50%"],
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: {
          borderColor: "#ffffff",
          borderWidth: 3,
        },
        data: normalized.map((item, index) => ({
          name: item.label,
          value: item.count,
          itemStyle: { color: PURPLE_SCALE[index % PURPLE_SCALE.length] },
        })),
      },
    ],
  };
}

function buildDonutOption(
  data: LabelCount[],
  centerLabel: string
): EChartsOption {
  const normalized = withOtherGroup(data, 5);
  const total = normalized.reduce((sum, item) => sum + item.count, 0);
  return {
    tooltip: {
      trigger: "item",
      formatter: (params: { name?: string; value?: number; percent?: number }) => {
        return `${params.name}<br/>${formatNumber(params.value ?? 0)} (${(
          params.percent ?? 0
        ).toFixed(1)}%)`;
      },
    },
    title: {
      text: formatNumber(total),
      subtext: centerLabel,
      left: "33%",
      top: "39%",
      textAlign: "center",
      textStyle: {
        color: "#1d2742",
        fontSize: 22,
        fontWeight: 800,
      },
      subtextStyle: {
        color: "#6b7893",
        fontSize: 11,
        fontWeight: 700,
      },
      itemGap: 2,
    },
    legend: {
      orient: "vertical",
      right: 10,
      top: "middle",
      icon: "circle",
      itemHeight: 8,
      itemWidth: 8,
      itemGap: 10,
      textStyle: { color: "#53627d", fontSize: 11, fontWeight: 600 },
      type: "scroll",
      pageIconColor: "#4b359a",
      pageTextStyle: { color: "#53627d", fontSize: 11 },
    },
    series: [
      {
        type: "pie",
        radius: ["50%", "72%"],
        center: ["33%", "50%"],
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderColor: "#ffffff", borderWidth: 3 },
        data: normalized.map((item, index) => ({
          name: item.label,
          value: item.count,
          itemStyle: { color: DONUT_SCALE[index % DONUT_SCALE.length] },
        })),
      },
    ],
  };
}

const CHROM_ORDER = [
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "X", "Y", "M", "MT",
];

function buildChromOption(data: LabelCount[]): EChartsOption {
  const normalized = cleanLabels(data).map((item) => ({
    label: item.label.replace(/^chr/i, "").toUpperCase(),
    count: item.count,
  }));
  const ordered = normalized
    .filter((item) => CHROM_ORDER.includes(item.label))
    .sort(
      (a, b) => CHROM_ORDER.indexOf(a.label) - CHROM_ORDER.indexOf(b.label)
    );
  const categories = ordered.map((item) => item.label);
  const total = ordered.reduce((sum, item) => sum + item.count, 0);
  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: Array<{ name: string; value: number }>) => {
        const p = params[0];
        const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : "0.0";
        return `chr${p.name}<br/>${formatNumber(p.value)} variants (${pct}%)`;
      },
    },
    grid: { left: 56, right: 20, top: 24, bottom: 46, containLabel: true },
    xAxis: {
      type: "category",
      data: categories,
      axisLabel: {
        color: "#5c6b86",
        fontSize: 9,
        interval: (index: number, value: string) => {
          if (["X", "Y", "M", "MT"].includes(value)) return false;
          const numeric = Number(value);
          return Number.isNaN(numeric) ? false : numeric % 2 === 1;
        },
        margin: 10,
      },
      axisTick: { alignWithLabel: true, lineStyle: { color: "#c6cfde" } },
      axisLine: { lineStyle: { color: "#c6cfde" } },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "rgba(80, 95, 128, 0.12)" } },
      axisLabel: {
        color: "#5c6b86",
        fontSize: 11,
        formatter: (value: number) => {
          if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
          if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
          return String(value);
        },
      },
    },
    series: [
      {
        type: "bar",
        data: ordered.map((item) => item.count),
        barMaxWidth: 18,
        itemStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "#8a70d2" },
              { offset: 1, color: "#4b359a" },
            ],
          },
          borderRadius: [5, 5, 0, 0],
        },
      },
    ],
  };
}

function buildCompositionBarOption(
  data: LabelCount[],
  unitLabel: string
): EChartsOption {
  const normalized = withOtherGroup(data, 6)
    .sort((a, b) => b.count - a.count)
    .reverse();
  const total = normalized.reduce((sum, item) => sum + item.count, 0);
  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: Array<{ name: string; value: number }>) => {
        const p = params[0];
        const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : "0.0";
        return `${p.name}<br/>${formatNumber(p.value)} ${unitLabel} (${pct}%)`;
      },
    },
    grid: { left: 170, right: 80, top: 20, bottom: 24, containLabel: true },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "rgba(80, 95, 128, 0.12)" } },
      axisLabel: {
        color: "#5c6b86",
        fontSize: 11,
        formatter: (value: number) => {
          if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
          if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
          return String(value);
        },
      },
    },
    yAxis: {
      type: "category",
      data: normalized.map((item) => item.label),
      axisLabel: {
        color: "#33415c",
        fontSize: 11,
        fontWeight: 700,
      },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#c6cfde" } },
    },
    series: [
      {
        type: "bar",
        data: normalized.map((item) => item.count),
        barMaxWidth: 18,
        itemStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: "#b7a0e5" },
              { offset: 1, color: "#6548b8" },
            ],
          },
          borderRadius: [0, 10, 10, 0],
        },
        label: {
          show: true,
          position: "right",
          color: "#4b359a",
          fontWeight: 700,
          fontSize: 11,
          formatter: (p: { value: number }) => formatNumber(p.value),
        },
      },
    ],
  };
}

function buildTopGenesOption(
  items: Array<{ gene: string; count: number }>
): EChartsOption {
  const reversed = [...items]
    .sort((a, b) => b.count - a.count)
    .reverse();
  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: Array<{ name: string; value: number }>) => {
        const p = params[0];
        return `${p.name}<br/>${formatNumber(p.value)} mutations`;
      },
    },
    grid: { left: 100, right: 88, top: 16, bottom: 32, containLabel: true },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "rgba(80, 95, 128, 0.12)" } },
      axisLabel: {
        color: "#5c6b86",
        formatter: (value: number) => {
          if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
          if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
          return String(value);
        },
      },
    },
    yAxis: {
      type: "category",
      data: reversed.map((item) => item.gene),
      axisLabel: {
        color: "#33415c",
        fontWeight: 700,
        fontSize: 12,
      },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#c6cfde" } },
    },
    series: [
      {
        type: "bar",
        data: reversed.map((item) => item.count),
        barMaxWidth: 18,
        itemStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: "#9a83dd" },
              { offset: 1, color: "#4b359a" },
            ],
          },
          borderRadius: [0, 10, 10, 0],
        },
        label: {
          show: true,
          position: "right",
          color: "#4b359a",
          fontWeight: 700,
          fontSize: 11,
          formatter: (p: { value: number }) => formatNumber(p.value),
        },
      },
    ],
  };
}

function StatScope({
  children,
}: {
  children: string;
}) {
  return <span className="statistics-private-card-scope">{children}</span>;
}

function KpiTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="statistics-private-kpi-tile">
      <span className="statistics-private-kpi-label">{label}</span>
      <strong className="statistics-private-kpi-value">
        {formatNumber(value)}
      </strong>
      {hint ? <span className="statistics-private-kpi-hint">{hint}</span> : null}
    </div>
  );
}

export function StatisticsPage() {
  const navigate = useNavigate();
  const overviewQ = useQuery({
    queryKey: ["statistics-overview-cfdna"],
    queryFn: getStatisticsOverview,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const overview = overviewQ.data;
  const cancerSummary = overview?.cancerSummary ?? [];
  const activeCohorts = useMemo(
    () => cancerSummary.filter((item) => item.sampleCount > 0),
    [cancerSummary]
  );
  const sampleSum = activeCohorts.reduce(
    (sum, item) => sum + item.sampleCount,
    0
  );
  const mafSummary = overview?.mafSummary;
  const totalSamples = mafSummary?.totalSamples ?? sampleSum;
  const totalVariants = mafSummary?.totalVariants ?? 0;
  const totalGenes = mafSummary?.totalGenes ?? 0;

  const topGeneItems = useMemo(
    () => overview?.topGenes ?? [],
    [overview]
  );

  const loading = overviewQ.isLoading;
  const cohortChartLoading = overviewQ.isLoading;
  const funcChartLoading = overviewQ.isLoading;
  const exonicChartLoading = overviewQ.isLoading;
  const chromChartLoading = overviewQ.isLoading;
  const topGenesChartLoading = overviewQ.isLoading;

  const topGeneChartEvents = useMemo(
    () => ({
      click: (params: { name?: string; componentType?: string }) => {
        if (params.componentType !== "series" || !params.name) return;
        navigate(`/gene-search/${encodeURIComponent(params.name)}`);
      },
    }),
    [navigate]
  );

  return (
    <div className="page-stack statistics-private-page">
      <SectionHeader
        eyebrow="Database Statistics"
        title="Mutational Landscape of the cfDNA Liquid-Biopsy Database"
        description="A database-wide visual summary of somatic mutations curated from the full cfDNA liquid-biopsy sample collection across all indexed cancer cohorts."
      />

      <section className="detail-card statistics-private-toolbar-card">
        <div className="statistics-private-toolbar-row">
          <div className="statistics-private-toolbar-meta">
            <p className="section-eyebrow">Data Source</p>
            <strong>cfDNA Liquid Biopsy Collection</strong>
          </div>
          <div className="statistics-private-toolbar-badge">
            <span>Cohorts</span>
            <strong>{formatNumber(activeCohorts.length)}</strong>
          </div>
        </div>
      </section>

      <section className="statistics-private-kpis">
        <KpiTile label="Samples" value={totalSamples} hint="Unique barcodes" />
        <KpiTile
          label="Variants"
          value={totalVariants}
          hint="Annotated mutation calls"
        />
        <KpiTile
          label="Mutated Genes"
          value={totalGenes}
          hint="Distinct Hugo symbols"
        />
        <KpiTile
          label="Cancer Cohorts"
          value={activeCohorts.length}
          hint="With somatic data"
        />
      </section>

      {loading ? (
        <p className="panel-note">Loading database statistics...</p>
      ) : null}

      <section className="statistics-private-grid">
        <article className="detail-card statistics-private-card">
          <header className="statistics-private-card-header">
            <div className="statistics-private-card-header-row">
              <p className="section-eyebrow">Cohort Composition</p>
              <StatScope>sample-level</StatScope>
            </div>
            <h3>Sample Distribution Across Cancer Cohorts</h3>
          </header>
          <div className="statistics-private-card-body">
            <ReactECharts
              option={buildCohortDonutOption(activeCohorts, totalSamples)}
              showLoading={cohortChartLoading}
              loadingOption={CHART_LOADING_OPTION}
              style={{ height: 380 }}
            />
          </div>
        </article>

        <article className="detail-card statistics-private-card">
          <header className="statistics-private-card-header">
            <div className="statistics-private-card-header-row">
              <p className="section-eyebrow">Functional Region</p>
              <StatScope>variant-level</StatScope>
            </div>
            <h3>Variant Distribution by Genomic Region</h3>
          </header>
          <div className="statistics-private-card-body">
            <ReactECharts
              option={buildDonutOption(overview?.funcDistribution ?? [], "variants")}
              showLoading={funcChartLoading}
              loadingOption={CHART_LOADING_OPTION}
              style={{ height: 380 }}
            />
          </div>
        </article>

        <article className="detail-card statistics-private-card">
          <header className="statistics-private-card-header">
            <div className="statistics-private-card-header-row">
              <p className="section-eyebrow">Exonic Consequence</p>
              <StatScope>variant-level</StatScope>
            </div>
            <h3>Coding Consequence Composition</h3>
          </header>
          <div className="statistics-private-card-body">
            <ReactECharts
              option={buildCompositionBarOption(overview?.exonicDistribution ?? [], "variants")}
              showLoading={exonicChartLoading}
              loadingOption={CHART_LOADING_OPTION}
              style={{ height: 380 }}
            />
          </div>
        </article>

        <article className="detail-card statistics-private-card">
          <header className="statistics-private-card-header">
            <div className="statistics-private-card-header-row">
              <p className="section-eyebrow">Chromosomal Distribution</p>
              <StatScope>variant-level</StatScope>
            </div>
            <h3>Variant Counts per Chromosome</h3>
          </header>
          <div className="statistics-private-card-body">
            <ReactECharts
              option={buildChromOption(overview?.chromDistribution ?? [])}
              showLoading={chromChartLoading}
              loadingOption={CHART_LOADING_OPTION}
              style={{ height: 380 }}
            />
          </div>
        </article>

        <article className="detail-card statistics-private-card statistics-private-card--full">
          <header className="statistics-private-card-header">
            <div className="statistics-private-card-header-row">
              <p className="section-eyebrow">Top Mutated Genes</p>
              <StatScope>gene-level</StatScope>
            </div>
            <h3>Most Frequently Mutated Genes in the cfDNA Database</h3>
          </header>
          <div className="statistics-private-card-body">
            <ReactECharts
              option={buildTopGenesOption(topGeneItems)}
              onEvents={topGeneChartEvents}
              showLoading={topGenesChartLoading}
              loadingOption={CHART_LOADING_OPTION}
              style={{ height: 460 }}
            />
            <p className="statistics-private-chart-hint">
              Click a gene bar to open its gene detail page.
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
