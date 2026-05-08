import { useMemo, useRef, useEffect, useCallback, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import {
  getStatisticsOverview,
  getStatisticsPublicCohorts,
  getStatisticsPublicOverview,
  getVafDistribution,
} from "../api/client";
import type { CancerSummary, LabelCount, VafDistribution } from "../types/api";
import { formatCohortLabel } from "../utils/cohortLabels";
import { formatNumber } from "../utils/format";

const CHART_LOADING_OPTION = {
  text: "Loading chart...",
  color: "#2C3A85",
  textColor: "#5c6b86",
  maskColor: "rgba(255, 255, 255, 0.72)",
  zlevel: 0,
  fontSize: 13,
  spinnerRadius: 12,
  lineWidth: 3,
};

const STANDARD_STAT_CHART_STYLE = { width: "100%", height: 430 };
const STAT_BAR_COLORS = ["#2C3A85", "#1D56A7", "#2872CF", "#4B90DF", "#75AFE9"];
const STAT_BAR_GRID = { left: 154, right: 78, top: 22, bottom: 34, containLabel: true } as const;

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

interface StatRow {
  label: string;
  count: number;
  percentage?: number;
}

function toStatRows(items: LabelCount[], limit = 10): StatRow[] {
  const sorted = [...cleanLabels(items)].sort((a, b) => b.count - a.count);
  const total = sorted.reduce((sum, item) => sum + item.count, 0);
  return sorted.slice(0, limit).map((item) => ({
    label: item.label,
    count: item.count,
    percentage: total > 0 ? (item.count / total) * 100 : 0,
  }));
}

function toCohortRows(items: CancerSummary[], limit = 10): StatRow[] {
  const sorted = [...items]
    .filter((item) => item.sampleCount > 0)
    .sort((a, b) => b.sampleCount - a.sampleCount);
  const total = sorted.reduce((sum, item) => sum + item.sampleCount, 0);
  return sorted.slice(0, limit).map((item) => ({
    label: formatCohortLabel(item.cancer),
    count: item.sampleCount,
    percentage: total > 0 ? (item.sampleCount / total) * 100 : 0,
  }));
}

function formatPercent(value?: number) {
  if (value == null) return "-";
  return `${value.toFixed(1)}%`;
}

function StatTable({
  rows,
  labelHeader,
  countHeader = "Count",
}: {
  rows: StatRow[];
  labelHeader: string;
  countHeader?: string;
}) {
  return (
    <div className="statistics-rna-table-wrap">
      <table className="statistics-rna-table">
        <thead>
          <tr>
            <th>{labelHeader}</th>
            <th>{countHeader}</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td>{formatNumber(row.count)}</td>
              <td>{formatPercent(row.percentage)}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan={3}>No statistics available.</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="statistics-rna-table-meta">
        Showing 1 to {rows.length} of {rows.length} entries
      </div>
    </div>
  );
}

function StatisticsSplitSection({
  title,
  intro,
  rows,
  labelHeader,
  countHeader,
  children,
}: {
  title: string;
  intro: ReactNode;
  rows: StatRow[];
  labelHeader: string;
  countHeader?: string;
  children: ReactNode;
}) {
  return (
    <section className="statistics-rna-section">
      <div className="statistics-rna-section-title">
        <h2>{title}</h2>
        <p>{intro}</p>
      </div>
      <div className="statistics-rna-split">
        <StatTable rows={rows} labelHeader={labelHeader} countHeader={countHeader} />
        <div className="statistics-rna-chart">{children}</div>
      </div>
    </section>
  );
}

function formatAxisCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

function buildSortedBarOption(
  data: LabelCount[],
  unitLabel: string,
): EChartsOption {
  const normalized = [...cleanLabels(data)].sort((a, b) => b.count - a.count);
  const chartData = [...normalized].reverse();
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
    grid: STAT_BAR_GRID,
    dataZoom: normalized.length > 12 ? [
      {
        type: "slider",
        yAxisIndex: 0,
        right: 8,
        width: 12,
        startValue: Math.max(chartData.length - 12, 0),
        endValue: chartData.length - 1,
        borderColor: "#d7deeb",
        fillerColor: "rgba(44, 58, 133, 0.18)",
        handleSize: 0,
        showDetail: false,
      },
      { type: "inside", yAxisIndex: 0 },
    ] : undefined,
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "rgba(80, 95, 128, 0.12)" } },
      axisLabel: {
        color: "#5c6b86",
        fontSize: 11,
        formatter: (value: number) => formatAxisCount(value),
      },
    },
    yAxis: {
      type: "category",
      data: chartData.map((item) => item.label),
      axisLabel: {
        color: "#33415c",
        fontSize: 11,
        fontWeight: 700,
        width: 132,
        overflow: "truncate",
      },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#c6cfde" } },
    },
    series: [
      {
        type: "bar",
        data: chartData.map((item, index) => ({
          value: item.count,
          itemStyle: { color: STAT_BAR_COLORS[index % STAT_BAR_COLORS.length] },
        })),
        barMaxWidth: 22,
        itemStyle: {
          borderRadius: [0, 9, 9, 0],
        },
        label: {
          show: true,
          position: "right",
          color: "#2C3A85",
          fontWeight: 700,
          fontSize: 11,
          formatter: (p: { value: number }) => formatNumber(p.value),
        },
      },
    ],
  };
}

function buildCohortBarOption(cancers: CancerSummary[]): EChartsOption {
  return buildSortedBarOption(
    cancers
      .filter((item) => item.sampleCount > 0)
      .map((item) => ({ label: formatCohortLabel(item.cancer), count: item.sampleCount })),
    "samples",
  );
}

const CHROM_ORDER = [
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "X", "Y", "M", "MT",
];

function normalizeChromData(data: LabelCount[]): LabelCount[] {
  const normalized = cleanLabels(data).map((item) => ({
    label: item.label.replace(/^chr/i, "").toUpperCase(),
    count: item.count,
  }));
  return normalized
    .filter((item) => CHROM_ORDER.includes(item.label))
    .map((item) => ({ label: `chr${item.label}`, count: item.count }));
}

function buildCompositionBarOption(
  data: LabelCount[],
  unitLabel: string
): EChartsOption {
  return buildSortedBarOption(withOtherGroup(data, 6), unitLabel);
}

// ---- Ridgeline / KDE helpers ----

/** Gaussian kernel density estimation */
function gaussianKDE(values: number[], bandwidth: number, xGrid: number[]): number[] {
  const n = values.length;
  if (n === 0) return xGrid.map(() => 0);
  const factor = 1 / (n * bandwidth * Math.sqrt(2 * Math.PI));
  return xGrid.map((x) => {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const z = (x - values[i]) / bandwidth;
      sum += Math.exp(-0.5 * z * z);
    }
    return sum * factor;
  });
}

/** Silverman's rule of thumb for bandwidth selection */
function silvermanBandwidth(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0.05;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const std = Math.sqrt(variance);
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  const spread = Math.min(std, iqr / 1.34);
  return 0.9 * spread * Math.pow(n, -0.2);
}

const RIDGE_COLORS = [
  "#1a1a2e", "#16213e", "#0f3460", "#1b4965", "#2d6a4f",
  "#40916c", "#52796f", "#5f0f40", "#7b2d8e", "#9b2335",
  "#c1666b", "#48639c", "#457b9d", "#264653", "#6a4c93",
  "#3a5a7c", "#8d6b94",
];

function RidgelinePlot({ data }: { data: VafDistribution[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || data.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const rowHeight = 40;
    const h = data.length * rowHeight + 100;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Layout
    const labelWidth = 130;
    const padRight = 40;
    const padTop = 45;
    const padBottom = 45;
    const plotLeft = labelWidth;
    const plotRight = w - padRight;
    const plotWidth = plotRight - plotLeft;
    const plotTop = padTop;
    const plotBottom = h - padBottom;
    const plotHeight = plotBottom - plotTop;

    const xMin = 0.15;
    const xMax = 0.9;
    const gridPoints = 200;
    const xGrid: number[] = [];
    for (let i = 0; i < gridPoints; i++) {
      xGrid.push(xMin + (xMax - xMin) * (i / (gridPoints - 1)));
    }

    // Coordinate converters
    const xToPixel = (v: number) => plotLeft + ((v - xMin) / (xMax - xMin)) * plotWidth;
    const bandwidths = data.map((d) => Math.max(silvermanBandwidth(d.values), 0.005));
    const densities = data.map((d, i) => gaussianKDE(d.values, bandwidths[i], xGrid));
    const globalMax = Math.max(...densities.flat(), 1e-10);

    const ridgePxHeight = rowHeight * 0.85;

    // Baseline y for each ridge (bottom of each row, drawing bottom-up)
    const baselineY = (idx: number) => plotBottom - (idx + 0.5) * (plotHeight / data.length);

    // Title
    ctx.fillStyle = "#1d2742";
    ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("VAF Distribution by Cancer Type", w / 2, 28);

    // Reference dashed lines at 0.3 and 0.8
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "#5dade2";
    ctx.lineWidth = 1.5;
    for (const refVal of [0.3, 0.8]) {
      const rx = xToPixel(refVal);
      ctx.beginPath();
      ctx.moveTo(rx, plotTop - 5);
      ctx.lineTo(rx, plotBottom + 5);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw ridges back-to-front (top row first so bottom rows overlap on top)
    for (let idx = data.length - 1; idx >= 0; idx--) {
      const d = data[idx];
      const density = densities[idx];
      const color = RIDGE_COLORS[idx % RIDGE_COLORS.length];
      const by = baselineY(idx);

      // Filled density polygon
      ctx.beginPath();
      ctx.moveTo(xToPixel(xGrid[0]), by);
      for (let i = 0; i < gridPoints; i++) {
        const px = xToPixel(xGrid[i]);
        const py = by - (density[i] / globalMax) * ridgePxHeight;
        if (i === 0) ctx.lineTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.lineTo(xToPixel(xGrid[gridPoints - 1]), by);
      ctx.closePath();

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.55;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Outline
      ctx.beginPath();
      for (let i = 0; i < gridPoints; i++) {
        const px = xToPixel(xGrid[i]);
        const py = by - (density[i] / globalMax) * ridgePxHeight;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = "#1a1a2e";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Scatter points
      const bw = bandwidths[idx];
      ctx.fillStyle = "rgba(26, 26, 46, 0.35)";
      for (const v of d.values) {
        const dAtPt = gaussianKDE(d.values, bw, [v])[0];
        const relH = (dAtPt / globalMax) * ridgePxHeight;
        const jitter = (Math.random() - 0.5) * relH * 0.5;
        const px = xToPixel(v);
        const py = by - relH * 0.55 + jitter;
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Y-axis label
      ctx.fillStyle = "#33415c";
      ctx.font = "600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(formatVafCancerLabel(d.cancerType), plotLeft - 12, by);
    }

    // X-axis line
    ctx.strokeStyle = "#c6cfde";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotBottom);
    ctx.lineTo(plotRight, plotBottom);
    ctx.stroke();

    // X-axis ticks & labels
    ctx.fillStyle = "#5c6b86";
    ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let v = 0.2; v <= 0.9; v += 0.1) {
      const px = xToPixel(v);
      ctx.beginPath();
      ctx.moveTo(px, plotBottom);
      ctx.lineTo(px, plotBottom + 4);
      ctx.strokeStyle = "#c6cfde";
      ctx.stroke();
      ctx.fillText(v.toFixed(1), px, plotBottom + 7);
    }

    // X-axis name
    ctx.fillStyle = "#33415c";
    ctx.font = "600 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Average VAF", (plotLeft + plotRight) / 2, plotBottom + 28);

    // Kruskal-Wallis annotation
    ctx.fillStyle = "#c0392b";
    ctx.font = "italic 600 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("Kruskal-Wallis: p < 0.001***", plotRight, padTop - 10);
  }, [data]);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(() => draw());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const tooltip = tooltipRef.current;
      if (!canvas || !tooltip || data.length === 0) return;

      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const labelWidth = 130;
      const padRight = 40;
      const padTop = 45;
      const padBottom = 45;
      const plotLeft = labelWidth;
      const plotBottom = canvas.clientHeight - padBottom;
      const plotHeight = plotBottom - padTop;
      const rowH = plotHeight / data.length;

      const baselineY = (idx: number) => plotBottom - (idx + 0.5) * rowH;

      let hit = -1;
      for (let idx = 0; idx < data.length; idx++) {
        const by = baselineY(idx);
        if (my >= by - rowH * 0.9 && my <= by + rowH * 0.3 && mx >= plotLeft && mx <= canvas.clientWidth - padRight) {
          hit = idx;
          break;
        }
      }

      if (hit >= 0) {
        const d = data[hit];
        const mean = (d.values.reduce((s, v) => s + v, 0) / d.values.length).toFixed(4);
        tooltip.innerHTML = `<b>${d.cancerType.replace(/_/g, " ")}</b><br/>Samples: ${d.sampleCount}<br/>Mean VAF: ${mean}`;
        tooltip.style.display = "block";
        tooltip.style.left = `${e.clientX - rect.left + 14}px`;
        tooltip.style.top = `${e.clientY - rect.top - 10}px`;
      } else {
        tooltip.style.display = "none";
      }
    },
    [data]
  );

  const handleMouseLeave = useCallback(() => {
    if (tooltipRef.current) tooltipRef.current.style.display = "none";
  }, []);

  const h = data.length * 40 + 100;

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", minHeight: Math.max(500, h) }}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ display: "block", width: "100%" }}
      />
      <div
        ref={tooltipRef}
        style={{
          display: "none",
          position: "absolute",
          pointerEvents: "none",
          background: "rgba(50, 50, 50, 0.92)",
          color: "#fff",
          padding: "8px 12px",
          borderRadius: "4px",
          fontSize: "12px",
          lineHeight: 1.5,
          zIndex: 10,
          whiteSpace: "nowrap",
        }}
      />
    </div>
  );
}

function formatVafCancerLabel(value: string): string {
  if (value === "EGA") return "EGA_Lung";
  return value.replace(/_/g, " ");
}

export function StatisticsPage() {
  const [source, setSource] = useState<"private" | "public">("private");
  const [publicCohort, setPublicCohort] = useState<string | null>(null);

  const overviewQ = useQuery({
    queryKey: ["statistics-overview-cfdna"],
    queryFn: getStatisticsOverview,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const vafQ = useQuery({
    queryKey: ["vaf-distribution"],
    queryFn: getVafDistribution,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  const publicCohortsQ = useQuery({
    queryKey: ["statistics-public-cohorts"],
    queryFn: getStatisticsPublicCohorts,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  const publicCohorts = publicCohortsQ.data ?? [];
  useEffect(() => {
    if (source === "public" && publicCohort === null && publicCohorts.length > 0) {
      setPublicCohort(publicCohorts[0]);
    }
  }, [source, publicCohort, publicCohorts]);

  const publicOverviewQ = useQuery({
    queryKey: ["statistics-public-overview", publicCohort ?? ""],
    queryFn: () => getStatisticsPublicOverview(publicCohort ?? undefined),
    enabled: source === "public" && publicCohort !== null,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const isPublic = source === "public";
  const overview = isPublic ? publicOverviewQ.data : overviewQ.data;
  const cancerSummary = overview?.cancerSummary ?? [];
  const activeCohorts = useMemo(
    () => cancerSummary.filter((item) => item.sampleCount > 0),
    [cancerSummary]
  );
  const cancerCohorts = useMemo(
    () => activeCohorts.filter((item) => item.cancer !== "Healthy"),
    [activeCohorts]
  );
  const vafData = vafQ.data ?? [];

  const activeQ = isPublic ? publicOverviewQ : overviewQ;
  const loading = activeQ.isLoading;
  const cohortChartLoading = activeQ.isLoading;
  const funcChartLoading = activeQ.isLoading;
  const exonicChartLoading = activeQ.isLoading;
  const chromChartLoading = activeQ.isLoading;
  const cohortRows = useMemo(() => toCohortRows(activeCohorts, 10), [activeCohorts]);
  const funcRows = useMemo(() => toStatRows(overview?.funcDistribution ?? [], 10), [overview?.funcDistribution]);
  const exonicRows = useMemo(() => toStatRows(overview?.exonicDistribution ?? [], 10), [overview?.exonicDistribution]);
  const chromRows = useMemo(() => {
    const normalized = normalizeChromData(overview?.chromDistribution ?? []);
    const total = normalized.reduce((sum, item) => sum + item.count, 0);
    return normalized
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((item) => ({
        label: item.label,
        count: item.count,
        percentage: total > 0 ? (item.count / total) * 100 : 0,
      }));
  }, [overview?.chromDistribution]);

  return (
    <div className="page-stack statistics-rna-page">
      <section className="statistics-rna-intro">
        <div>
          <h1>Statistic Of Dataset</h1>
          <p>
            <strong>{isPublic ? "Public cohort" : "Collected Samples"} statistics</strong> across ctDNA mutation datasets in our collection.
          </p>
        </div>
        <div className="statistics-rna-controls">
          <button
            type="button"
            className={!isPublic ? "active" : ""}
            onClick={() => setSource("private")}
          >
            Collected Samples
          </button>
          <button
            type="button"
            className={isPublic ? "active" : ""}
            onClick={() => setSource("public")}
            disabled={publicCohortsQ.isLoading}
          >
            Public Cohorts
          </button>
        </div>
      </section>

      {isPublic ? (
        <div className="statistics-rna-cohort-strip">
          {publicCohorts.length === 0 && publicCohortsQ.isFetched ? (
            <span>No public cohorts imported yet.</span>
          ) : null}
          {publicCohorts.map((cohort) => (
            <button
              type="button"
              key={cohort}
              className={publicCohort === cohort ? "active" : ""}
              onClick={() => setPublicCohort(cohort)}
            >
              {formatCohortLabel(cohort)}
            </button>
          ))}
        </div>
      ) : (
        <div className="statistics-rna-cohort-strip">
          <button type="button" className="active">Collected Samples</button>
        </div>
      )}

      {loading ? (
        <p className="panel-note">Loading database statistics...</p>
      ) : null}

      <StatisticsSplitSection
        title="Statistic Of Disease"
        intro={<><strong>Cancer type and Healthy</strong> across ctDNA cohorts in our collection.</>}
        rows={cohortRows}
        labelHeader="Disease"
        countHeader="Sample Count"
      >
        <ReactECharts
          option={buildCohortBarOption(activeCohorts)}
          showLoading={cohortChartLoading}
          loadingOption={CHART_LOADING_OPTION}
          style={STANDARD_STAT_CHART_STYLE}
        />
      </StatisticsSplitSection>

      <StatisticsSplitSection
        title="Statistic Of Genomic Region"
        intro={<><strong>Variant region</strong> distribution across the selected data source.</>}
        rows={funcRows}
        labelHeader="Region"
      >
        <ReactECharts
          option={buildSortedBarOption(overview?.funcDistribution ?? [], "variants")}
          showLoading={funcChartLoading}
          loadingOption={CHART_LOADING_OPTION}
          style={STANDARD_STAT_CHART_STYLE}
        />
      </StatisticsSplitSection>

      <StatisticsSplitSection
        title="Statistic Of Coding Consequence"
        intro={<><strong>Coding consequence</strong> counts across filtered mutation records.</>}
        rows={exonicRows}
        labelHeader="Consequence"
      >
        <ReactECharts
          option={buildCompositionBarOption(overview?.exonicDistribution ?? [], "variants")}
          showLoading={exonicChartLoading}
          loadingOption={CHART_LOADING_OPTION}
          style={STANDARD_STAT_CHART_STYLE}
        />
      </StatisticsSplitSection>

      <StatisticsSplitSection
        title="Statistic Of Chromosome"
        intro={<><strong>Chromosome</strong> mutation counts across the selected data source.</>}
        rows={chromRows}
        labelHeader="Chromosome"
      >
        <ReactECharts
          option={buildSortedBarOption(normalizeChromData(overview?.chromDistribution ?? []), "variants")}
          showLoading={chromChartLoading}
          loadingOption={CHART_LOADING_OPTION}
          style={STANDARD_STAT_CHART_STYLE}
        />
      </StatisticsSplitSection>

      {/* Ridgeline Plot — VAF Distribution (private only; public aggregates lack per-sample VAF) */}
      {!isPublic ? (
        <section className="statistics-rna-section statistics-rna-section--wide">
          <div className="statistics-rna-section-title">
            <h2>Statistic Of VAF</h2>
            <p><strong>Variant allele frequency</strong> distribution by cancer type.</p>
          </div>
          <div className="statistics-rna-ridge">
            {vafQ.isLoading ? (
              <p className="panel-note">Loading VAF distribution...</p>
            ) : vafData.length > 0 ? (
              <RidgelinePlot data={vafData} />
            ) : (
              <p className="panel-note">No VAF data available</p>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
