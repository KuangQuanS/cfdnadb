import { useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useNavigate } from "react-router-dom";
import { SectionHeader } from "../components/SectionHeader";
import { getStatisticsOverview, getVafDistribution } from "../api/client";
import type { CancerSummary, LabelCount, VafDistribution } from "../types/api";
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
      ctx.fillText(d.cancerType.replace(/_/g, " "), plotLeft - 12, by);
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

  const vafQ = useQuery({
    queryKey: ["vaf-distribution"],
    queryFn: getVafDistribution,
    staleTime: 10 * 60_000,
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
  const totalSamples = sampleSum;
  const totalVariants = mafSummary?.totalVariants ?? 0;
  const totalGenes = mafSummary?.totalGenes ?? 0;

  const vafData = vafQ.data ?? [];

  const loading = overviewQ.isLoading;
  const cohortChartLoading = overviewQ.isLoading;
  const funcChartLoading = overviewQ.isLoading;
  const exonicChartLoading = overviewQ.isLoading;
  const chromChartLoading = overviewQ.isLoading;

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

      </section>

      {/* Ridgeline Plot — VAF Distribution */}
      <section className="statistics-private-ridge-section">
        <article className="detail-card statistics-private-card statistics-private-card-wide">
          <header className="statistics-private-card-header">
            <div className="statistics-private-card-header-row">
              <p className="section-eyebrow">VAF Analysis</p>
              <StatScope>sample-level</StatScope>
            </div>
            <h3>VAF Distribution by Cancer Type</h3>
          </header>
          <div className="statistics-private-card-body">
            {vafQ.isLoading ? (
              <p className="panel-note">Loading VAF distribution...</p>
            ) : vafData.length > 0 ? (
              <RidgelinePlot data={vafData} />
            ) : (
              <p className="panel-note">No VAF data available</p>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
