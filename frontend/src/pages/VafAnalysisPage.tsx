import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { getVafBodyMap } from "../api/client";
import { SectionHeader } from "../components/SectionHeader";
import { OrganIcon } from "../components/icons/OrganIcon";
import type { VafBodyMapEntry } from "../types/api";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "")) as string;
const DEFAULT_GENE = "ERBB2";

type CohortNode = {
  organKey: string;
  label: string;
  code: string;
  left: number;
  top: number;
};

const COHORT_NODES: CohortNode[] = [
  { organKey: "brain", label: "Brain", code: "CNS", left: 50, top: 9 },
  { organKey: "lung", label: "Lung", code: "LUNG", left: 22, top: 20 },
  { organKey: "breast", label: "Breast", code: "BRCA", left: 78, top: 20 },
  { organKey: "thyroid", label: "Thyroid", code: "THYR", left: 90, top: 43 },
  { organKey: "kidney", label: "Kidney", code: "KIDN", left: 84, top: 68 },
  { organKey: "ovarian", label: "Ovarian", code: "OV", left: 64, top: 87 },
  { organKey: "bladder", label: "Bladder", code: "BLCA", left: 36, top: 87 },
  { organKey: "colorectal", label: "Colorectal", code: "CRC", left: 16, top: 68 },
  { organKey: "liver", label: "Liver", code: "LIHC", left: 10, top: 43 },
  { organKey: "gastric", label: "Gastric", code: "GAST", left: 30, top: 57 },
  { organKey: "pancreatic", label: "Pancreatic", code: "PDAC", left: 70, top: 57 },
];

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

interface OmicsResult {
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

const GROUP_COLORS: Record<string, string> = {
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

async function apiGet<T>(path: string): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const payload = await resp.json();
  return payload.data as T;
}

function formatVaf(value: number) {
  if (!Number.isFinite(value)) return "-";
  return value.toFixed(3);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function buildOrganEntryMap(entries: VafBodyMapEntry[]) {
  const map = new Map<string, VafBodyMapEntry>();
  for (const entry of entries) {
    const current = map.get(entry.organKey);
    if (!current || entry.meanVaf > current.meanVaf) {
      map.set(entry.organKey, entry);
    }
  }
  return map;
}

function markerColor(ratio: number) {
  if (ratio >= 0.67) return "#d95f45";
  if (ratio >= 0.34) return "#f0a142";
  return "#3f9caf";
}

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

function boxOption(result: OmicsResult, title: string): EChartsOption {
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
  names.forEach((n) => {
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

function hasBoxGroups(result: OmicsResult | undefined) {
  return Boolean(result && Object.keys(result.groups ?? {}).length > 0);
}

export function VafAnalysisPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryGene = (searchParams.get("gene") ?? DEFAULT_GENE).trim() || DEFAULT_GENE;
  const [geneInput, setGeneInput] = useState(queryGene);

  useEffect(() => {
    setGeneInput(queryGene);
  }, [queryGene]);

  const vafQ = useQuery({
    queryKey: ["vaf-bodymap", queryGene],
    queryFn: () => getVafBodyMap(queryGene),
    staleTime: 5 * 60_000,
  });
  const cfMethQ = useQuery({
    queryKey: ["vaf-analysis-omics", "cfMethDB", queryGene],
    queryFn: () => apiGet<OmicsResult>(`/api/survival/multiomics/cfmethdb?gene=${encodeURIComponent(queryGene)}`),
    enabled: Boolean(queryGene),
    staleTime: 5 * 60_000,
  });
  const cfOmicsMethQ = useQuery({
    queryKey: ["vaf-analysis-omics", "cfOmics", queryGene],
    queryFn: () => apiGet<OmicsResult>(`/api/survival/multiomics/cfomics-methylation?gene=${encodeURIComponent(queryGene)}`),
    enabled: Boolean(queryGene),
    staleTime: 5 * 60_000,
  });
  const ctcExprQ = useQuery({
    queryKey: ["vaf-analysis-omics", "ctc", queryGene],
    queryFn: () => apiGet<OmicsResult>(`/api/survival/multiomics/ctc-expression?gene=${encodeURIComponent(queryGene)}`),
    enabled: Boolean(queryGene),
    staleTime: 5 * 60_000,
  });

  const entries = vafQ.data?.entries ?? [];
  const maxMean = vafQ.data?.maxMeanVaf ?? 0;
  const organEntries = useMemo(() => buildOrganEntryMap(entries), [entries]);
  const totalRecords = entries.reduce((sum, entry) => sum + entry.recordCount, 0);
  const totalSamples = entries.reduce((sum, entry) => sum + entry.sampleCount, 0);
  const cfMethOpt = useMemo(
    () => (hasBoxGroups(cfMethQ.data) ? boxOption(cfMethQ.data!, `${cfMethQ.data!.gene} cfMethDB methylation across cancer types`) : null),
    [cfMethQ.data]
  );
  const cfOmicsMethOpt = useMemo(
    () => (hasBoxGroups(cfOmicsMethQ.data) ? boxOption(cfOmicsMethQ.data!, `${cfOmicsMethQ.data!.gene} cfOmics methylation across cancer types`) : null),
    [cfOmicsMethQ.data]
  );
  const ctcExprOpt = useMemo(
    () => (hasBoxGroups(ctcExprQ.data) ? boxOption(ctcExprQ.data!, `${ctcExprQ.data!.gene} CTC expression across cancer types`) : null),
    [ctcExprQ.data]
  );

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const nextGene = geneInput.trim();
    const next = new URLSearchParams(searchParams);
    if (nextGene) next.set("gene", nextGene);
    else next.delete("gene");
    setSearchParams(next);
  };

  return (
    <div className="page-stack vaf-analysis-page">
      <SectionHeader
        eyebrow="Tools"
        title="VAF Analysis"
        description="Gene-level variant allele frequency across mounted private cfDNA cohorts."
      />

      <section className="detail-card vaf-analysis-shell">
        <div className="vaf-analysis-controls">
          <form className="vaf-analysis-form" onSubmit={submitSearch}>
            <label htmlFor="vaf-gene-input">Gene Symbol</label>
            <div className="vaf-analysis-search-row">
              <input
                id="vaf-gene-input"
                value={geneInput}
                onChange={(event) => setGeneInput(event.target.value)}
                placeholder="ERBB2, TP53, PIK3CA..."
              />
              <button className="button-primary" type="submit">Plot</button>
            </div>
          </form>

          <div className="vaf-analysis-metrics" aria-label="VAF summary">
            <div>
              <span>Gene</span>
              <strong>{vafQ.data?.gene ?? queryGene.toUpperCase()}</strong>
            </div>
            <div>
              <span>Cohorts</span>
              <strong>{entries.length}</strong>
            </div>
            <div>
              <span>Samples</span>
              <strong>{totalSamples}</strong>
            </div>
            <div>
              <span>Records</span>
              <strong>{totalRecords}</strong>
            </div>
          </div>

          <div className="vaf-analysis-legend" aria-label="VAF heat scale">
            <span>Low mean VAF</span>
            <div aria-hidden="true" />
            <span>High mean VAF</span>
          </div>
        </div>

        <div className="vaf-analysis-workspace">
          <div className="vaf-bodymap-panel">
            <div className="vaf-icon-map" aria-label={`${queryGene} VAF organ map`}>
              <div className="vaf-icon-map-core">
                <strong>{vafQ.data?.gene ?? queryGene.toUpperCase()}</strong>
                <span>mean VAF map</span>
              </div>
              {COHORT_NODES.map((node) => {
                const entry = organEntries.get(node.organKey);
                const active = Boolean(entry);
                const ratio = entry && maxMean > 0 ? Math.max(0.18, entry.meanVaf / maxMean) : 0;
                const style = {
                  "--vaf-node-left": `${node.left}%`,
                  "--vaf-node-top": `${node.top}%`,
                  "--vaf-node-size": `${active ? 50 + ratio * 16 : 46}px`,
                  "--vaf-node-color": active ? markerColor(ratio) : "#9aa8ba",
                } as CSSProperties;
                return (
                  <div
                    key={node.organKey}
                    className={`vaf-cohort-node${active ? " vaf-cohort-node--active" : ""}`}
                    style={style}
                    title={entry ? `${node.label}: mean VAF ${formatVaf(entry.meanVaf)} (${entry.sampleCount} samples)` : `${node.label}: no data`}
                  >
                    <OrganIcon organ={node.organKey} className="vaf-cohort-icon" />
                    <strong>{entry?.cancerType ?? node.label}</strong>
                    <small>{entry ? formatVaf(entry.meanVaf) : "No data"}</small>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="vaf-analysis-table-wrap">
            {vafQ.isLoading ? (
              <p className="panel-note">Loading VAF data...</p>
            ) : vafQ.isError ? (
              <p className="panel-note">VAF data request failed. Check that the backend is running with the mounted VAF directory.</p>
            ) : entries.length > 0 ? (
              <table className="vaf-analysis-table">
                <thead>
                  <tr>
                    <th>Cohort</th>
                    <th>Mean VAF</th>
                    <th>Median</th>
                    <th>Max</th>
                    <th>Samples</th>
                    <th>Records</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.cohort}>
                      <td>{entry.cancerType}</td>
                      <td>{formatVaf(entry.meanVaf)} <span>{formatPercent(entry.meanVaf)}</span></td>
                      <td>{formatVaf(entry.medianVaf)}</td>
                      <td>{formatVaf(entry.maxVaf)}</td>
                      <td>{entry.sampleCount}</td>
                      <td>{entry.recordCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="panel-note">No mounted gene-level VAF file was found for {queryGene.toUpperCase()}.</p>
            )}
          </div>
        </div>
      </section>

      <section className="survival-results survival-results--omics vaf-omics-results">
        <div className="survival-masthead-copy">
          <h2>Methylation and CTC</h2>
        </div>

        <section className="survival-plots vaf-omics-plots">
          <article className="survival-plot-card">
            <div className="survival-plot-card-header">
              <div>
                <h3>cfMethDB methylation</h3>
              </div>
            </div>
            <div className="survival-chart-frame survival-chart-frame--omics">
              {cfMethQ.isLoading ? (
                <p className="panel-note">Loading cfMethDB methylation...</p>
              ) : cfMethOpt ? (
                <ReactECharts option={cfMethOpt} style={{ width: "100%", height: "100%" }} />
              ) : (
                <p className="panel-note">No cfMethDB methylation data available</p>
              )}
            </div>
          </article>

          <article className="survival-plot-card">
            <div className="survival-plot-card-header">
              <div>
                <h3>cfOmics methylation</h3>
              </div>
            </div>
            <div className="survival-chart-frame survival-chart-frame--omics">
              {cfOmicsMethQ.isLoading ? (
                <p className="panel-note">Loading cfOmics methylation...</p>
              ) : cfOmicsMethOpt ? (
                <ReactECharts option={cfOmicsMethOpt} style={{ width: "100%", height: "100%" }} />
              ) : (
                <p className="panel-note">No cfOmics methylation data available</p>
              )}
            </div>
          </article>

          <article className="survival-plot-card">
            <div className="survival-plot-card-header">
              <div>
                <h3>CTC FPKM expression</h3>
              </div>
            </div>
            <div className="survival-chart-frame survival-chart-frame--omics">
              {ctcExprQ.isLoading ? (
                <p className="panel-note">Loading CTC FPKM expression...</p>
              ) : ctcExprOpt ? (
                <ReactECharts option={ctcExprOpt} style={{ width: "100%", height: "100%" }} />
              ) : (
                <p className="panel-note">No CTC FPKM expression data available</p>
              )}
            </div>
          </article>
        </section>
      </section>
    </div>
  );
}
