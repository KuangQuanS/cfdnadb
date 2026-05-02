import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "")) as string;

interface KmGroup {
  name: string;
  n: number;
  events: number;
  points: [number, number][];
  ciUpper?: [number, number][];
  ciLower?: [number, number][];
  censorMarks?: [number, number][];
  atRisk: [number, number][];
}

interface KmResult {
  cohort: string;
  gene: string;
  timeUnit: string;
  groups: Record<string, KmGroup>;
  pairwiseP: Record<string, number | string | null>;
  pairwiseHr?: Record<string, number | string | null> | null;
  overallP?: number | string | null;
}

interface BoxStats {
  n: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  whiskerLow: number;
  whiskerHigh: number;
  points: number[];
}

interface VafResult {
  cohort: string;
  gene: string;
  title?: string;
  xLabel: string;
  yLabel?: string;
  yScale?: "value" | "log";
  groups: Record<string, BoxStats>;
  pairwiseP?: Record<string, number | string | null> | null;
  overallP?: number | string | null;
}

async function apiGet<T>(path: string): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const payload = await resp.json();
  return payload.data as T;
}

const GROUP_COLORS: Record<string, string> = {
  Mutant: "#E8A33D",
  Wildtype: "#4B8FC7",
  Frameshift: "#E74C3C",
  Missense: "#2E86AB",
  Nonsense: "#F4B942",
  Synonymous: "#16A085",
  Splice_Site: "#9B59B6",
  Inframe: "#B8C34B",
  Other: "#C0392B",
  I: "#7FC4E6",
  II: "#56B6A6",
  III: "#E6C656",
  IV: "#E28960"
};

const BOX_PALETTE = [
  "#8CCBC4",
  "#F3E889",
  "#B8B4D8",
  "#EF8F85",
  "#85B7D8",
  "#F3B267",
  "#A7CF63",
  "#67B7DC",
  "#E56B8A",
  "#5DAF8B"
];

function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatP(p: number | string | null | undefined): string {
  const value = toFiniteNumber(p);
  if (value == null) return "-";
  if (value < 0.0001) return "< 0.0001";
  return value.toFixed(4);
}

function formatHr(hr: number | string | null | undefined): string {
  const value = toFiniteNumber(hr);
  if (value == null) return "-";
  return value.toFixed(2);
}

function buildStepLine(points: [number, number][]) {
  return points.map(([x, y]) => [x, y]);
}

function kmOption(result: KmResult, title: string): EChartsOption {
  const series: any[] = [];
  const legendEntries = Object.values(result.groups).map((g) => `${g.name} (n=${g.n})`);
  Object.values(result.groups).forEach((g) => {
    const color = GROUP_COLORS[g.name] ?? "#888";
    const lineName = `${g.name} (n=${g.n})`;
    series.push({
      name: lineName,
      type: "line",
      step: "end",
      data: buildStepLine(g.points),
      showSymbol: false,
      lineStyle: { color, width: 2.4 },
      itemStyle: { color }
    });
      if (false && g.ciUpper?.length) {
      series.push({
        name: `${lineName} CI Upper`,
        type: "line",
        step: "end",
        data: buildStepLine(g.ciUpper),
        showSymbol: false,
        lineStyle: { color, width: 1.3, type: "dotted", opacity: 0.9 },
        emphasis: { disabled: true },
        silent: true
      });
    }
      if (false && g.ciLower?.length) {
      series.push({
        name: `${lineName} CI Lower`,
        type: "line",
        step: "end",
        data: buildStepLine(g.ciLower),
        showSymbol: false,
        lineStyle: { color, width: 1.3, type: "dotted", opacity: 0.9 },
        emphasis: { disabled: true },
        silent: true
      });
    }
  });
  const pLines: string[] = [];
  if (result.pairwiseP) {
    Object.entries(result.pairwiseP).forEach(([k, v]) => {
      const hr = result.pairwiseHr?.[k];
      pLines.push(`${k.replace(/_/g, " ")}: HR = ${formatHr(hr)}, p = ${formatP(v)}`);
    });
  }
  return {
    title: { text: title, left: "center", textStyle: { fontSize: 15, fontWeight: 600 } },
    tooltip: {
      trigger: "axis",
      valueFormatter: (v: any) => (typeof v === "number" ? v.toFixed(3) : v)
    },
    legend: { top: 40, data: legendEntries, textStyle: { fontSize: 12 } },
    grid: {
      left: 68,
      right: 26,
      top: 146,
      bottom: 76,
      show: true,
      borderColor: "#202020",
      borderWidth: 1,
      backgroundColor: "#ffffff"
    },
    xAxis: {
      type: "value",
      name: `Time (${result.timeUnit})`,
      nameLocation: "middle",
      nameGap: 32,
      nameTextStyle: { fontSize: 13 },
      axisLine: { show: true, lineStyle: { color: "#202020", width: 1 } },
      axisTick: { show: true, lineStyle: { color: "#202020" } }
    },
    yAxis: {
      type: "value",
      name: "Overall Survival",
      nameLocation: "middle",
      nameGap: 46,
      nameTextStyle: { fontSize: 13 },
      min: 0,
      max: 1,
      axisLine: { show: true, lineStyle: { color: "#202020", width: 1 } },
      axisTick: { show: true, lineStyle: { color: "#202020" } }
    },
    series,
    graphic: pLines.length
      ? {
          left: 84,
          bottom: 92,
          type: "text",
          style: {
            text: pLines.join("\n"),
            fontSize: 11,
            lineHeight: 18,
            fill: "#2a2a2a",
            textAlign: "left"
          }
        }
      : undefined
  };
}

function AtRiskTable({ result }: { result: KmResult }) {
  const groups = Object.values(result.groups);
  if (!groups.length || !groups[0].atRisk?.length) return null;
  const times = groups[0].atRisk.map(([t]) => t);
  return (
    <div
      style={{
        maxWidth: 700,
        margin: "10px auto 0",
        padding: "10px 14px 12px",
        border: "1px solid #202020",
        background: "#ffffff",
        fontSize: 12
      }}
    >
      <div style={{ fontWeight: 600, color: "#333", marginBottom: 8 }}>Number at risk</div>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                padding: "6px 8px",
                color: "#555",
                fontWeight: 500,
                width: 120,
                borderBottom: "1px solid #d9d9d9"
              }}
            >
              Group
            </th>
            {times.map((t) => (
              <th
                key={t}
                style={{
                  textAlign: "center",
                  padding: "6px 8px",
                  color: "#555",
                  fontWeight: 500,
                  borderBottom: "1px solid #d9d9d9"
                }}
              >
                {Math.round(t)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.name}>
              <td
                style={{
                  padding: "4px 6px",
                  color: GROUP_COLORS[g.name] ?? "#333",
                  fontWeight: 600,
                  borderBottom: "1px solid #ececec"
                }}
              >
                {g.name}
              </td>
              {g.atRisk.map(([t, n]) => (
                <td
                  key={t}
                  style={{
                    padding: "4px 6px",
                    textAlign: "center",
                    color: GROUP_COLORS[g.name] ?? "#333",
                    borderBottom: "1px solid #ececec"
                  }}
                >
                  {n}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function boxOption(result: VafResult, title: string): EChartsOption {
  const names = Object.keys(result.groups);
  const colors = names.map((n, i) => GROUP_COLORS[n] ?? BOX_PALETTE[i % BOX_PALETTE.length]);
  const hasLongLabels = names.some((name) => name.length > 10);
  const labelRotate = names.length > 7 ? 45 : hasLongLabels ? 30 : 0;
  const boxData = names.map((n, i) => ({
    value: (() => {
      const b = result.groups[n];
      return [b.whiskerLow, b.q1, b.median, b.q3, b.whiskerHigh];
    })(),
    itemStyle: { color: colors[i], borderColor: "#2d3b52" }
  }));
  const scatterData: Array<{ value: [string, number]; symbolOffset: [number, number] }> = [];
  names.forEach((n, i) => {
    const b = result.groups[n];
    b.points.forEach((v) => {
      const jitterPx = Math.round((Math.random() - 0.5) * 48);
      scatterData.push({ value: [n, v], symbolOffset: [jitterPx, 0] });
    });
  });
  const subtitle = toFiniteNumber(result.overallP) != null ? `p = ${formatP(result.overallP)}` : "";
  return {
    title: {
      text: title,
      subtext: subtitle,
      left: "center",
      textStyle: { fontSize: 15, fontWeight: 600 },
      subtextStyle: { fontSize: 12 }
    },
    tooltip: { trigger: "item" },
    grid: {
      left: 72,
      right: 28,
      top: 108,
      bottom: labelRotate ? 132 : 96,
      show: true,
      borderColor: "#202020",
      borderWidth: 1,
      backgroundColor: "#ffffff"
    },
    xAxis: {
      type: "category",
      data: names,
      name: result.xLabel,
      nameLocation: "middle",
      nameGap: labelRotate ? 78 : 38,
      nameTextStyle: { fontSize: 13 },
      axisLabel: {
        interval: 0,
        rotate: labelRotate,
        hideOverlap: false,
        margin: 14,
        width: 92,
        overflow: "break"
      },
      axisLine: { show: true, lineStyle: { color: "#202020", width: 1 } },
      axisTick: { show: true, lineStyle: { color: "#202020" } }
    },
    yAxis: {
      type: result.yScale === "log" ? "log" : "value",
      min: result.yScale === "log" ? 0.01 : undefined,
      name: result.yLabel ?? "Variant Allele Frequency (VAF)",
      nameLocation: "middle",
      nameGap: 48,
      nameTextStyle: { fontSize: 13 },
      axisLine: { show: true, lineStyle: { color: "#202020", width: 1 } },
      axisTick: { show: true, lineStyle: { color: "#202020" } }
    },
    series: [
      {
        name: "Box",
        type: "boxplot",
        data: boxData,
        boxWidth: ["40%", "62%"]
      },
      {
        name: "Samples",
        type: "scatter",
        data: scatterData,
        symbolSize: 8,
        itemStyle: { color: "rgba(45,45,45,0.55)" }
      }
    ]
  };
}

function formatCohortLabel(cohort: string): string {
  return cohort.replace("TCGA-", "");
}

function sanitizeFileStem(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]+/g, "_").replace(/^_+|_+$/g, "");
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function createSingleImagePdfBlob(jpegDataUrl: string, imageWidth: number, imageHeight: number): Blob {
  const jpegBytes = dataUrlToUint8Array(jpegDataUrl);
  const pageWidth = 842;
  const pageHeight = 842;
  const margin = 32;
  const drawableWidth = pageWidth - margin * 2;
  const drawableHeight = pageHeight - margin * 2;
  const scale = Math.min(drawableWidth / imageWidth, drawableHeight / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const offsetX = (pageWidth - drawWidth) / 2;
  const offsetY = (pageHeight - drawHeight) / 2;

  const encoder = new TextEncoder();
  const content = `q\n${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${offsetX.toFixed(2)} ${offsetY.toFixed(2)} cm\n/Im0 Do\nQ`;
  const contentBytes = encoder.encode(content);

  const objects: Uint8Array[][] = [
    [encoder.encode("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")],
    [encoder.encode("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")],
    [
      encoder.encode(
        `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>\nendobj\n`
      )
    ],
    [
      encoder.encode(
        `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${Math.round(imageWidth)} /Height ${Math.round(imageHeight)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
      ),
      jpegBytes,
      encoder.encode("\nendstream\nendobj\n")
    ],
    [
      encoder.encode(`5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`),
      contentBytes,
      encoder.encode("\nendstream\nendobj\n")
    ]
  ];

  const parts: Uint8Array[] = [];
  const offsets: number[] = [0];
  let position = 0;
  const header = encoder.encode("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");
  parts.push(header);
  position += header.length;

  objects.forEach((objectChunks, index) => {
    offsets[index + 1] = position;
    objectChunks.forEach((chunk) => {
      parts.push(chunk);
      position += chunk.length;
    });
  });

  const xrefOffset = position;
  const xrefEntries = ["0000000000 65535 f "];
  for (let i = 1; i <= 5; i++) {
    xrefEntries.push(`${String(offsets[i]).padStart(10, "0")} 00000 n `);
  }
  const xref = encoder.encode(`xref\n0 6\n${xrefEntries.join("\n")}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  parts.push(xref);

  return new Blob(parts, { type: "application/pdf" });
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load chart image"));
    image.src = src;
  });
}

async function createKmExportCanvas(chartDataUrl: string, result: KmResult): Promise<HTMLCanvasElement> {
  const image = await loadImage(chartDataUrl);
  const groups = Object.values(result.groups);
  const times = groups[0]?.atRisk?.map(([t]) => t) ?? [];
  const rowHeight = 34;
  const headerHeight = 28;
  const padding = 16;
  const tableHeight = headerHeight + Math.max(groups.length, 1) * rowHeight + padding * 2;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height + tableHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to create canvas context");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, image.width, image.height);

  const tableTop = image.height + 10;
  const tableLeft = 40;
  const tableWidth = canvas.width - 80;
  const labelWidth = 150;
  const valueWidth = times.length ? (tableWidth - labelWidth) / times.length : tableWidth - labelWidth;

  ctx.strokeStyle = "#202020";
  ctx.lineWidth = 1;
  ctx.strokeRect(tableLeft, tableTop, tableWidth, tableHeight - 20);

  ctx.fillStyle = "#222222";
  ctx.font = "600 18px Arial";
  ctx.fillText("Number at risk", tableLeft, tableTop - 10);

  ctx.font = "13px Arial";
  ctx.fillStyle = "#666666";
  ctx.textAlign = "left";
  ctx.fillText("Group", tableLeft + 12, tableTop + padding + 4);
  ctx.textAlign = "center";
  times.forEach((t, index) => {
    const x = tableLeft + labelWidth + valueWidth * index + valueWidth / 2;
    ctx.fillText(`${Math.round(t)}`, x, tableTop + padding + 4);
    ctx.strokeStyle = "#e1e1e1";
    ctx.beginPath();
    ctx.moveTo(tableLeft + labelWidth + valueWidth * index, tableTop);
    ctx.lineTo(tableLeft + labelWidth + valueWidth * index, tableTop + tableHeight - 20);
    ctx.stroke();
  });
  ctx.strokeStyle = "#d9d9d9";
  ctx.beginPath();
  ctx.moveTo(tableLeft, tableTop + padding + 10);
  ctx.lineTo(tableLeft + tableWidth, tableTop + padding + 10);
  ctx.stroke();

  groups.forEach((group, rowIndex) => {
    const y = tableTop + padding + headerHeight + rowHeight * rowIndex;
    ctx.strokeStyle = "#ececec";
    ctx.beginPath();
    ctx.moveTo(tableLeft, y + rowHeight / 2);
    ctx.lineTo(tableLeft + tableWidth, y + rowHeight / 2);
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = GROUP_COLORS[group.name] ?? "#333333";
    ctx.font = "600 13px Arial";
    ctx.fillText(group.name, tableLeft + 12, y + 6);
    ctx.textAlign = "center";
    group.atRisk.forEach(([_, n], index) => {
      const x = tableLeft + labelWidth + valueWidth * index + valueWidth / 2;
      ctx.fillText(`${n}`, x, y + 6);
    });
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#333333";
  ctx.font = "14px Arial";
  ctx.fillText(`Time (${result.timeUnit})`, tableLeft + tableWidth / 2, tableTop + tableHeight - 2);
  return canvas;
}

type PlotKey = "mutStatus" | "mutType" | "vafStage" | "vafMut" | "cfMeth" | "cfOmicsMeth" | "ctcExpr";

export function SurvivalAnalysisPage() {
  const [searchParams] = useSearchParams();
  const queryGene = (searchParams.get("gene") ?? "").trim().toUpperCase();
  const initialGene = queryGene || "TP53";

  const [cohorts, setCohorts] = useState<string[]>([]);
  const [cohort, setCohort] = useState<string>("TCGA-BRCA");
  const [gene, setGene] = useState<string>(initialGene);
  const [geneInput, setGeneInput] = useState<string>(initialGene);
  const [timeUnit, setTimeUnit] = useState<string>("months");
  const [enabledPlots, setEnabledPlots] = useState<Record<string, boolean>>({
    mutStatus: true,
    mutType: true,
    vafStage: true,
    vafMut: true,
    cfMeth: true,
    cfOmicsMeth: true,
    ctcExpr: true
  });

  const [kmStatus, setKmStatus] = useState<KmResult | null>(null);
  const [kmType, setKmType] = useState<KmResult | null>(null);
  const [vafStage, setVafStage] = useState<VafResult | null>(null);
  const [vafMut, setVafMut] = useState<VafResult | null>(null);
  const [cfMeth, setCfMeth] = useState<VafResult | null>(null);
  const [cfOmicsMeth, setCfOmicsMeth] = useState<VafResult | null>(null);
  const [ctcExpr, setCtcExpr] = useState<VafResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const chartRefs = useRef<Partial<Record<PlotKey, ReactECharts | null>>>({});

  useEffect(() => {
    apiGet<string[]>("/api/survival/cohorts")
      .then((list) => {
        setCohorts(list);
        if (list.length && !list.includes(cohort)) setCohort(list[0]);
      })
      .catch((e) => setError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!queryGene) return;
    setGene(queryGene);
    setGeneInput(queryGene);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryGene]);

  const runPlot = async () => {
    if (!gene || !cohort) return;
    setLoading(true);
    setError(null);
    try {
      const encodedGene = encodeURIComponent(gene);
      const encodedCohort = encodeURIComponent(cohort);
      const encodedTimeUnit = encodeURIComponent(timeUnit);
      const tasks: Promise<void>[] = [];
      if (enabledPlots.mutStatus) {
        tasks.push(
          apiGet<KmResult>(
            `/api/survival/km?cohort=${encodedCohort}&gene=${encodedGene}&groupBy=mutation_status&timeUnit=${encodedTimeUnit}`
          ).then(setKmStatus)
        );
      } else setKmStatus(null);
      if (enabledPlots.mutType) {
        tasks.push(
          apiGet<KmResult>(
            `/api/survival/km?cohort=${encodedCohort}&gene=${encodedGene}&groupBy=mutation_type&timeUnit=${encodedTimeUnit}`
          ).then(setKmType)
        );
      } else setKmType(null);
      if (enabledPlots.vafStage) {
        tasks.push(
          apiGet<VafResult>(`/api/survival/vaf-stage?cohort=${encodedCohort}&gene=${encodedGene}`).then(setVafStage)
        );
      } else setVafStage(null);
      if (enabledPlots.vafMut) {
        tasks.push(
          apiGet<VafResult>(`/api/survival/vaf-mutation?cohort=${encodedCohort}&gene=${encodedGene}`).then(setVafMut)
        );
      } else setVafMut(null);
      if (enabledPlots.cfMeth) {
        tasks.push(
          apiGet<VafResult>(`/api/survival/multiomics/cfmethdb?gene=${encodedGene}`).then(setCfMeth)
        );
      } else setCfMeth(null);
      if (enabledPlots.cfOmicsMeth) {
        tasks.push(
          apiGet<VafResult>(`/api/survival/multiomics/cfomics-methylation?gene=${encodedGene}`).then(setCfOmicsMeth)
        );
      } else setCfOmicsMeth(null);
      if (enabledPlots.ctcExpr) {
        tasks.push(
          apiGet<VafResult>(`/api/survival/multiomics/ctc-expression?gene=${encodedGene}`).then(setCtcExpr)
        );
      } else setCtcExpr(null);
      await Promise.all(tasks);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cohorts.length && gene) runPlot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohorts.length]);

  const kmStatusOpt = useMemo(
    () => (kmStatus ? kmOption(kmStatus, `${kmStatus.gene} Mutation Status - ${kmStatus.cohort}`) : null),
    [kmStatus]
  );
  const kmTypeOpt = useMemo(
    () => (kmType ? kmOption(kmType, `${kmType.gene} Survival by Mutation Type - ${kmType.cohort}`) : null),
    [kmType]
  );
  const vafStageOpt = useMemo(
    () => (vafStage ? boxOption(vafStage, `${vafStage.gene} VAF by Main Stage - ${vafStage.cohort}`) : null),
    [vafStage]
  );
  const vafMutOpt = useMemo(
    () => (vafMut ? boxOption(vafMut, `${vafMut.gene} VAF by Mutation Type - ${vafMut.cohort}`) : null),
    [vafMut]
  );
  const cfMethOpt = useMemo(
    () => (cfMeth ? boxOption(cfMeth, `${cfMeth.gene} cfMethDB methylation across cancer types`) : null),
    [cfMeth]
  );
  const cfOmicsMethOpt = useMemo(
    () => (cfOmicsMeth ? boxOption(cfOmicsMeth, `${cfOmicsMeth.gene} cfOmics methylation across cancer types`) : null),
    [cfOmicsMeth]
  );
  const ctcExprOpt = useMemo(
    () => (ctcExpr ? boxOption(ctcExpr, `${ctcExpr.gene} CTC expression across cancer types`) : null),
    [ctcExpr]
  );

  const togglePlot = (key: string) =>
    setEnabledPlots((prev) => ({ ...prev, [key]: !prev[key] }));

  const exportChart = async (
    plotKey: PlotKey,
    mode: "png" | "pdf",
    stem: string,
    kmResult?: KmResult | null
  ) => {
    const instance = chartRefs.current[plotKey]?.getEchartsInstance();
    if (!instance) return;
    const pixelRatio = 2;
    const fileStem = sanitizeFileStem(stem);

    if (kmResult) {
      const chartDataUrl = instance.getDataURL({ type: "png", pixelRatio, backgroundColor: "#ffffff" });
      const exportCanvas = await createKmExportCanvas(chartDataUrl, kmResult);
      if (mode === "png") {
        triggerDownload(exportCanvas.toDataURL("image/png"), `${fileStem}.png`);
        return;
      }
      const pdfBlob = createSingleImagePdfBlob(
        exportCanvas.toDataURL("image/jpeg", 0.96),
        exportCanvas.width,
        exportCanvas.height
      );
      const objectUrl = URL.createObjectURL(pdfBlob);
      triggerDownload(objectUrl, `${fileStem}.pdf`);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
      return;
    }

    if (mode === "png") {
      const dataUrl = instance.getDataURL({ type: "png", pixelRatio, backgroundColor: "#ffffff" });
      triggerDownload(dataUrl, `${fileStem}.png`);
      return;
    }
    const jpegDataUrl = instance.getDataURL({ type: "jpeg", pixelRatio, backgroundColor: "#ffffff" });
    const pdfBlob = createSingleImagePdfBlob(
      jpegDataUrl,
      instance.getWidth() * pixelRatio,
      instance.getHeight() * pixelRatio
    );
    const objectUrl = URL.createObjectURL(pdfBlob);
    triggerDownload(objectUrl, `${fileStem}.pdf`);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
  };

  return (
    <div className="page-stack survival-page">
      <section className="survival-shell">
        <div className="survival-masthead">
          <div className="survival-masthead-copy">
            <h1>Survival analysis</h1>
          </div>
        </div>

        <div className="survival-shell-divider" />

        <section className="survival-controls survival-workspace">
          <div className="survival-controls-header">
            <h2>{formatCohortLabel(cohort)} analysis controls</h2>
          </div>

          <div className="survival-controls-grid">
            <div className="survival-control-block survival-control-block--query">
              <label className="survival-field">
                <span>Gene symbol</span>
                <input
                  value={geneInput}
                  onChange={(e) => setGeneInput(e.target.value.trim().toUpperCase())}
                  placeholder="e.g. TP53"
                />
              </label>
              <label className="survival-field">
                <span>Time unit</span>
                <select value={timeUnit} onChange={(e) => setTimeUnit(e.target.value)}>
                  <option value="months">Months</option>
                  <option value="days">Days</option>
                </select>
              </label>
            </div>

            <div className="survival-control-block survival-control-block--plots">
              <div className="survival-check-grid">
                {(
                  [
                    ["mutStatus", "Mutation Status (KM)"],
                    ["mutType", "Survival by Mutation Type"],
                    ["vafStage", "VAF by Stage"],
                    ["vafMut", "VAF by Mutation Type"],
                    ["cfMeth", "cfMethDB methylation"],
                    ["cfOmicsMeth", "cfOmics methylation"],
                    ["ctcExpr", "CTC FPKM expression"]
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="survival-check">
                    <input type="checkbox" checked={enabledPlots[key]} onChange={() => togglePlot(key)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="survival-control-block survival-control-block--dataset">
              <select
                className="survival-cohort-list"
                size={8}
                value={cohort}
                onChange={(e) => setCohort(e.target.value)}
              >
                {cohorts.map((c) => (
                  <option key={c} value={c}>
                    {c.replace("TCGA-", "")}
                  </option>
                ))}
              </select>
            </div>

            <div className="survival-control-block survival-action">
              <button
                type="button"
                className="survival-plot-btn"
                onClick={() => {
                  setGene(geneInput);
                  setTimeout(runPlot, 0);
                }}
                disabled={loading || !geneInput}
              >
                {loading ? "Plotting..." : "Plot"}
              </button>
              {error && <p className="survival-error">{error}</p>}
            </div>
          </div>
        </section>
      </section>

      <section className="survival-results">
        <div className="survival-masthead-copy">
          <h2>TCGA {formatCohortLabel(cohort)}</h2>
        </div>

        <section className="survival-plots">
        {enabledPlots.mutStatus && kmStatusOpt && kmStatus && (
          <article className="survival-plot-card">
            <div className="survival-plot-card-header">
              <div>
                <h3>Mutation status survival</h3>
              </div>
              <div className="survival-plot-actions">
                <button
                  type="button"
                  onClick={() => exportChart("mutStatus", "png", `${gene}_${cohort}_mutation_status`, kmStatus)}
                >
                  PNG
                </button>
                <button
                  type="button"
                  onClick={() => exportChart("mutStatus", "pdf", `${gene}_${cohort}_mutation_status`, kmStatus)}
                >
                  PDF
                </button>
              </div>
            </div>
            <div className="survival-chart-frame survival-chart-frame--km">
              <ReactECharts
                ref={(node) => {
                  chartRefs.current.mutStatus = node;
                }}
                option={kmStatusOpt}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
            <AtRiskTable result={kmStatus} />
          </article>
        )}
        {enabledPlots.mutType && kmTypeOpt && kmType && (
          <article className="survival-plot-card">
            <div className="survival-plot-card-header">
              <div>
                <h3>Mutation type survival</h3>
              </div>
              <div className="survival-plot-actions">
                <button
                  type="button"
                  onClick={() => exportChart("mutType", "png", `${gene}_${cohort}_mutation_type_survival`, kmType)}
                >
                  PNG
                </button>
                <button
                  type="button"
                  onClick={() => exportChart("mutType", "pdf", `${gene}_${cohort}_mutation_type_survival`, kmType)}
                >
                  PDF
                </button>
              </div>
            </div>
            <div className="survival-chart-frame survival-chart-frame--km">
              <ReactECharts
                ref={(node) => {
                  chartRefs.current.mutType = node;
                }}
                option={kmTypeOpt}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
            <AtRiskTable result={kmType} />
          </article>
        )}
        {enabledPlots.vafStage && vafStageOpt && (
          <article className="survival-plot-card">
            <div className="survival-plot-card-header">
              <div>
                <h3>VAF by main stage</h3>
              </div>
              <div className="survival-plot-actions">
                <button type="button" onClick={() => exportChart("vafStage", "png", `${gene}_${cohort}_vaf_stage`)}>
                  PNG
                </button>
                <button type="button" onClick={() => exportChart("vafStage", "pdf", `${gene}_${cohort}_vaf_stage`)}>
                  PDF
                </button>
              </div>
            </div>
            <div className="survival-chart-frame survival-chart-frame--vaf">
              <ReactECharts
                ref={(node) => {
                  chartRefs.current.vafStage = node;
                }}
                option={vafStageOpt}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </article>
        )}
        {enabledPlots.vafMut && vafMutOpt && (
          <article className="survival-plot-card">
            <div className="survival-plot-card-header">
              <div>
                <h3>VAF by mutation type</h3>
              </div>
              <div className="survival-plot-actions">
                <button type="button" onClick={() => exportChart("vafMut", "png", `${gene}_${cohort}_vaf_mutation_type`)}>
                  PNG
                </button>
                <button type="button" onClick={() => exportChart("vafMut", "pdf", `${gene}_${cohort}_vaf_mutation_type`)}>
                  PDF
                </button>
              </div>
            </div>
            <div className="survival-chart-frame survival-chart-frame--vaf">
              <ReactECharts
                ref={(node) => {
                  chartRefs.current.vafMut = node;
                }}
                option={vafMutOpt}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </article>
        )}
        </section>
      </section>

      <section className="survival-results survival-results--omics">
        <div className="survival-masthead-copy">
          <h2>Methylation and CTC</h2>
        </div>

        <section className="survival-plots">
        {enabledPlots.cfMeth && cfMethOpt && (
          <article className="survival-plot-card">
            <div className="survival-plot-card-header">
              <div>
                <h3>cfMethDB methylation</h3>
              </div>
              <div className="survival-plot-actions">
                <button type="button" onClick={() => exportChart("cfMeth", "png", `${gene}_cfMethDB_methylation`)}>
                  PNG
                </button>
                <button type="button" onClick={() => exportChart("cfMeth", "pdf", `${gene}_cfMethDB_methylation`)}>
                  PDF
                </button>
              </div>
            </div>
            <div className="survival-chart-frame survival-chart-frame--omics">
              <ReactECharts
                ref={(node) => {
                  chartRefs.current.cfMeth = node;
                }}
                option={cfMethOpt}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </article>
        )}
        {enabledPlots.cfOmicsMeth && cfOmicsMethOpt && (
          <article className="survival-plot-card">
            <div className="survival-plot-card-header">
              <div>
                <h3>cfOmics methylation</h3>
              </div>
              <div className="survival-plot-actions">
                <button type="button" onClick={() => exportChart("cfOmicsMeth", "png", `${gene}_cfOmics_methylation`)}>
                  PNG
                </button>
                <button type="button" onClick={() => exportChart("cfOmicsMeth", "pdf", `${gene}_cfOmics_methylation`)}>
                  PDF
                </button>
              </div>
            </div>
            <div className="survival-chart-frame survival-chart-frame--omics">
              <ReactECharts
                ref={(node) => {
                  chartRefs.current.cfOmicsMeth = node;
                }}
                option={cfOmicsMethOpt}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </article>
        )}
        {enabledPlots.ctcExpr && ctcExprOpt && (
          <article className="survival-plot-card">
            <div className="survival-plot-card-header">
              <div>
                <h3>CTC FPKM expression</h3>
              </div>
              <div className="survival-plot-actions">
                <button type="button" onClick={() => exportChart("ctcExpr", "png", `${gene}_CTC_FPKM_expression`)}>
                  PNG
                </button>
                <button type="button" onClick={() => exportChart("ctcExpr", "pdf", `${gene}_CTC_FPKM_expression`)}>
                  PDF
                </button>
              </div>
            </div>
            <div className="survival-chart-frame survival-chart-frame--omics">
              <ReactECharts
                ref={(node) => {
                  chartRefs.current.ctcExpr = node;
                }}
                option={ctcExprOpt}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </article>
        )}
        </section>
      </section>
    </div>
  );
}
