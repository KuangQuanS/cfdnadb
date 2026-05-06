import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { getVafBodyMap } from "../api/client";
import { OrganIcon } from "../components/icons/OrganIcon";
import type { VafBodyMapEntry, VafBoxplot } from "../types/api";

const DEFAULT_GENE = "TTN";

type CohortNode = {
  organKey: string;
  label: string;
  code: string;
  left: number;
  top: number;
};

const COHORT_NODES: CohortNode[] = [
  { organKey: "brain", label: "Brain", code: "BRAIN", left: 50, top: 3 },
  { organKey: "headAndNeck", label: "Head & Neck", code: "HNSC", left: 50, top: 9 },
  { organKey: "lung", label: "Lung", code: "LUNG", left: 22, top: 20 },
  { organKey: "breast", label: "Breast", code: "BRCA", left: 78, top: 20 },
  { organKey: "thyroid", label: "Thyroid", code: "THYR", left: 90, top: 43 },
  { organKey: "kidney", label: "Kidney", code: "KIDN", left: 84, top: 68 },
  { organKey: "ovarian", label: "Ovarian", code: "OV", left: 78, top: 87 },
  { organKey: "endometrial", label: "Endometrial", code: "UCEC", left: 50, top: 87 },
  { organKey: "bladder", label: "Bladder", code: "BLCA", left: 22, top: 87 },
  { organKey: "colorectal", label: "Colorectal", code: "CRC", left: 16, top: 68 },
  { organKey: "liver", label: "Liver", code: "LIHC", left: 10, top: 43 },
  { organKey: "gastric", label: "Gastric", code: "GAST", left: 30, top: 57 },
  { organKey: "pancreatic", label: "Pancreatic", code: "PDAC", left: 70, top: 57 },
];

const GROUP_COLORS: Record<string, string> = {
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

function boxOption(result: VafBoxplot, title: string): EChartsOption {
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
  return {
    title: {
      text: title,
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
      type: "value",
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

function hasBoxGroups(result: VafBoxplot | null | undefined) {
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
  const entries = vafQ.data?.entries ?? [];
  const maxMean = vafQ.data?.maxMeanVaf ?? 0;
  const organEntries = useMemo(() => buildOrganEntryMap(entries), [entries]);
  const totalRecords = entries.reduce((sum, entry) => sum + entry.recordCount, 0);
  const totalSamples = entries.reduce((sum, entry) => sum + entry.sampleCount, 0);
  const cancerTypeBoxplot = vafQ.data?.cancerTypeBoxplot;
  const mutationTypeBoxplot = vafQ.data?.mutationTypeBoxplot;
  const cancerTypeOpt = useMemo(
    () =>
      hasBoxGroups(cancerTypeBoxplot)
        ? boxOption(cancerTypeBoxplot!, cancerTypeBoxplot!.title || `${queryGene.toUpperCase()} VAF by cancer type`)
        : null,
    [cancerTypeBoxplot, queryGene]
  );
  const mutationTypeOpt = useMemo(
    () =>
      hasBoxGroups(mutationTypeBoxplot)
        ? boxOption(mutationTypeBoxplot!, mutationTypeBoxplot!.title || `${queryGene.toUpperCase()} VAF by mutation type`)
        : null,
    [mutationTypeBoxplot, queryGene]
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
      <section className="database-page-intro vaf-analysis-intro">
        <div>
          <h1>VAF Analysis</h1>
          <p>Gene-level variant allele frequency across mounted private cfDNA cohorts.</p>
        </div>
      </section>

      <section className="detail-card vaf-analysis-shell tool-query-panel">
        <div className="vaf-analysis-controls">
          <form className="vaf-analysis-form" onSubmit={submitSearch}>
            <label htmlFor="vaf-gene-input">Gene Symbol</label>
            <div className="vaf-analysis-search-row">
              <input
                id="vaf-gene-input"
                value={geneInput}
                onChange={(event) => setGeneInput(event.target.value)}
                placeholder="TTN, TP53, PIK3CA..."
              />
              <button className="button-primary" type="submit">PLOT</button>
            </div>
          </form>

          <div className="vaf-analysis-metrics-wrap">
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
              <span>Low</span>
              <div aria-hidden="true" />
              <span>High</span>
            </div>
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

      <section className="survival-results survival-results--omics vaf-omics-results tool-section-panel">
        <div className="survival-masthead-copy">
          <h2>VAF boxplots</h2>
        </div>

        <section className="survival-plots vaf-omics-plots">
          <article className="survival-plot-card">
            <div className="survival-plot-card-header">
              <div>
                <h3>VAF by cancer type</h3>
              </div>
            </div>
            <div className="survival-chart-frame survival-chart-frame--vaf">
              {vafQ.isLoading ? (
                <p className="panel-note">Loading VAF by cancer type...</p>
              ) : cancerTypeOpt ? (
                <ReactECharts option={cancerTypeOpt} style={{ width: "100%", height: "100%" }} />
              ) : (
                <p className="panel-note">No VAF by cancer type data available</p>
              )}
            </div>
          </article>

          <article className="survival-plot-card">
            <div className="survival-plot-card-header">
              <div>
                <h3>VAF by mutation type</h3>
              </div>
            </div>
            <div className="survival-chart-frame survival-chart-frame--vaf">
              {vafQ.isLoading ? (
                <p className="panel-note">Loading VAF by mutation type...</p>
              ) : mutationTypeOpt ? (
                <ReactECharts option={mutationTypeOpt} style={{ width: "100%", height: "100%" }} />
              ) : (
                <p className="panel-note">No VAF by mutation type data available</p>
              )}
            </div>
          </article>
        </section>
      </section>
    </div>
  );
}
