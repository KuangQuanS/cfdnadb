import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import type { EChartsOption } from "echarts";
import {
  getFuncDistribution,
  getExonicDistribution,
  getChromDistribution,
  getSampleBurden,
  getTopGenes,
  getCancerAssets,
  toApiUrl
} from "../api/client";
import { ChartCard } from "../components/ChartCard";
import { SectionHeader } from "../components/SectionHeader";
import { CANCER_OPTIONS, DEFAULT_CANCER } from "../constants/cfdna";
import type { LabelCount } from "../types/api";
import { formatNumber } from "../utils/format";

const CHART_COLORS = [
  "#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de",
  "#3ba272", "#fc8452", "#9a60b4", "#ea7ccc", "#4ecdc4"
];

function buildPieOption(data: LabelCount[]): EChartsOption {
  return {
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { orient: "vertical", right: 10, top: "center", textStyle: { fontSize: 11 } },
    series: [{
      type: "pie", radius: ["40%", "70%"], center: ["38%", "50%"],
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 13, fontWeight: "bold" } },
      data: data.map((item, i) => ({
        name: item.label, value: item.count,
        itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] }
      }))
    }]
  };
}

function buildHBarOption(data: LabelCount[], xName: string): EChartsOption {
  const sorted = [...data].sort((a, b) => a.count - b.count);
  return {
    grid: { left: 160, right: 48, top: 16, bottom: 40 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "value", name: xName, nameLocation: "end" },
    yAxis: { type: "category", axisLabel: { fontSize: 11 }, data: sorted.map((d) => d.label) },
    series: [{
      type: "bar", data: sorted.map((d) => d.count),
      itemStyle: { color: "#5470c6" },
      label: { show: true, position: "right", fontSize: 10 }
    }]
  };
}

function buildChromBarOption(data: LabelCount[]): EChartsOption {
  return {
    grid: { left: 48, right: 24, top: 16, bottom: 52 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", axisLabel: { rotate: 40, fontSize: 10 }, data: data.map((d) => d.label) },
    yAxis: { type: "value", name: "Variants" },
    series: [{ type: "bar", data: data.map((d) => d.count), itemStyle: { color: "#73c0de" } }]
  };
}

function buildTopGeneOption(data: LabelCount[], cancer: string): EChartsOption {
  return {
    grid: { left: 48, right: 24, top: 24, bottom: 56 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", axisLabel: { rotate: 35 }, data: data.map((d) => d.label) },
    yAxis: { type: "value", name: "Variants" },
    series: [{ type: "bar", data: data.map((d) => d.count), itemStyle: { color: cancer === "Breast" ? "#FC812F" : "#5470c6" } }]
  };
}

function buildCompareOption(breastData: LabelCount[], colonData: LabelCount[]): EChartsOption {
  const top20 = Array.from(new Set([
    ...breastData.slice(0, 20).map((d) => d.label),
    ...colonData.slice(0, 20).map((d) => d.label)
  ])).slice(0, 20);
  const bMap = new Map(breastData.map((d) => [d.label, d.count]));
  const cMap = new Map(colonData.map((d) => [d.label, d.count]));
  const genes = top20.sort((a, b) => (bMap.get(b) ?? 0) + (cMap.get(b) ?? 0) - ((bMap.get(a) ?? 0) + (cMap.get(a) ?? 0)));
  return {
    grid: { left: 60, right: 24, top: 40, bottom: 68 },
    tooltip: { trigger: "axis" },
    legend: { data: ["Breast", "Colonrector"], top: 8 },
    xAxis: { type: "category", axisLabel: { rotate: 40, fontSize: 10 }, data: genes },
    yAxis: { type: "value", name: "Variants" },
    series: [
      { name: "Breast", type: "bar", data: genes.map((g) => bMap.get(g) ?? 0), itemStyle: { color: "#FC812F" } },
      { name: "Colonrector", type: "bar", data: genes.map((g) => cMap.get(g) ?? 0), itemStyle: { color: "#5470c6" } }
    ]
  };
}

export function MutationAnalysisPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const cancer = searchParams.get("cancer") ?? DEFAULT_CANCER;

  const funcQ = useQuery({ queryKey: ["func-dist", cancer], queryFn: () => getFuncDistribution(cancer) });
  const exonicQ = useQuery({ queryKey: ["exonic-dist", cancer], queryFn: () => getExonicDistribution(cancer) });
  const chromQ = useQuery({ queryKey: ["chrom-dist", cancer], queryFn: () => getChromDistribution(cancer) });
  const burdenQ = useQuery({ queryKey: ["sample-burden", cancer], queryFn: () => getSampleBurden(cancer, 20) });
  const topGeneQ = useQuery({ queryKey: ["top-genes", cancer, 15], queryFn: () => getTopGenes(cancer, 15) });
  const assetsQ = useQuery({ queryKey: ["cancer-assets", cancer], queryFn: () => getCancerAssets(cancer) });
  const breastTopQ = useQuery({ queryKey: ["top-genes", "Breast", 20], queryFn: () => getTopGenes("Breast", 20) });
  const colonTopQ = useQuery({ queryKey: ["top-genes", "Colonrector", 20], queryFn: () => getTopGenes("Colonrector", 20) });

  const changeCancer = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("cancer", value);
    setSearchParams(params);
  };

  const loading = funcQ.isLoading || topGeneQ.isLoading;
  const noData = !loading && funcQ.data?.length === 0 && topGeneQ.data?.length === 0;

  return (
    <div className="page-stack">
      <SectionHeader
        eyebrow="Mutation Analysis"
        title="Cohort variant statistics and PDF reports"
        description="Statistical charts from aggregate multianno files plus downloadable PDF plots. Currently available for Breast and Colorectal cohorts."
      />

      <section className="filter-panel">
        <label htmlFor="cancer-sel" style={{ marginRight: 8, fontWeight: 500 }}>Cohort:</label>
        <select id="cancer-sel" value={cancer} onChange={(e) => changeCancer(e.target.value)}>
          {CANCER_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        {noData && (
          <span className="panel-note" style={{ marginLeft: 16 }}>
            No aggregate multianno file yet for {cancer}.
          </span>
        )}
      </section>

      {loading && <p className="panel-note">Loading charts...</p>}

      {/* Top genes */}
      {topGeneQ.data && topGeneQ.data.length > 0 && (
        <ChartCard
          title={`${cancer} — Top 15 mutated genes`}
          option={buildTopGeneOption(topGeneQ.data.map((d) => ({ label: d.gene, count: d.count })), cancer)}
        />
      )}

      {/* Func + Exonic */}
      {!loading && (funcQ.data?.length ?? 0) > 0 && (
        <div className="chart-row-2col">
          <ChartCard title={`${cancer} — Variant functional region`} option={buildPieOption(funcQ.data!)} />
          {exonicQ.data && exonicQ.data.length > 0 && (
            <ChartCard title={`${cancer} — Exonic mutation type`} option={buildHBarOption(exonicQ.data, "Variants")} />
          )}
        </div>
      )}

      {/* Chromosome distribution */}
      {chromQ.data && chromQ.data.length > 0 && (
        <ChartCard title={`${cancer} — Variants per chromosome`} option={buildChromBarOption(chromQ.data)} />
      )}

      {/* Sample burden */}
      {burdenQ.data && burdenQ.data.length > 0 && (
        <ChartCard title={`${cancer} — Top 20 samples by mutation burden`} option={buildHBarOption(burdenQ.data, "Variants")} />
      )}

      {/* Cross-cohort comparison */}
      {breastTopQ.data && colonTopQ.data && breastTopQ.data.length > 0 && colonTopQ.data.length > 0 && (
        <section className="page-stack compact-gap">
          <SectionHeader eyebrow="Cross-cohort" title="Breast vs Colorectal — top mutated genes" />
          <ChartCard
            title="Breast vs Colonrector gene comparison"
            option={buildCompareOption(
              breastTopQ.data.map((d) => ({ label: d.gene, count: d.count })),
              colonTopQ.data.map((d) => ({ label: d.gene, count: d.count }))
            )}
          />
        </section>
      )}

      {/* PDF assets */}
      <section className="page-stack compact-gap">
        <SectionHeader eyebrow="PDF Reports" title="Plot and TCGA previews" />
        {assetsQ.isLoading && <p className="panel-note">Loading PDF assets...</p>}
        {assetsQ.data && assetsQ.data.length > 0 ? (
          <div className="pdf-grid">
            {assetsQ.data.map((asset) => (
              <article key={`${asset.category}-${asset.fileName}`} className="detail-card pdf-card">
                <div className="dataset-card-header">
                  <div>
                    <p className="section-eyebrow">{asset.category}</p>
                    <h3>{asset.title}</h3>
                  </div>
                  <span className="status-chip success">{formatNumber(asset.sizeBytes)} B</span>
                </div>
                <iframe className="pdf-frame" src={toApiUrl(asset.assetUrl)} title={asset.title} />
                <a className="button-secondary inline-button" href={toApiUrl(asset.assetUrl)} target="_blank" rel="noreferrer">
                  Open PDF
                </a>
              </article>
            ))}
          </div>
        ) : assetsQ.data && assetsQ.data.length === 0 ? (
          <section className="detail-card empty-card">
            <h3>No PDF reports available</h3>
            <p>{cancer} has no discoverable Plot or TCGA PDF files.</p>
          </section>
        ) : null}
      </section>
    </div>
  );
}
