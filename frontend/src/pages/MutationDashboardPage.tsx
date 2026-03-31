import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import type { EChartsOption } from "echarts";
import {
  getFuncDistribution,
  getExonicDistribution,
  getChromDistribution,
  getSampleBurden,
  getTopGenes
} from "../api/client";
import { ChartCard } from "../components/ChartCard";
import { SectionHeader } from "../components/SectionHeader";
import { CANCER_OPTIONS, DEFAULT_CANCER } from "../constants/cfdna";
import type { LabelCount } from "../types/api";

const CHART_COLORS = [
  "#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de",
  "#3ba272", "#fc8452", "#9a60b4", "#ea7ccc", "#4ecdc4"
];

function buildPieOption(data: LabelCount[]): EChartsOption {
  return {
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { orient: "vertical", right: 10, top: "center", textStyle: { fontSize: 11 } },
    series: [
      {
        type: "pie",
        radius: ["40%", "70%"],
        center: ["38%", "50%"],
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 13, fontWeight: "bold" } },
        data: data.map((item, i) => ({
          name: item.label,
          value: item.count,
          itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] }
        }))
      }
    ]
  };
}

function buildHBarOption(data: LabelCount[], xName: string): EChartsOption {
  const sorted = [...data].sort((a, b) => a.count - b.count);
  return {
    grid: { left: 160, right: 48, top: 16, bottom: 40 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "value", name: xName, nameLocation: "end" },
    yAxis: {
      type: "category",
      axisLabel: { fontSize: 11 },
      data: sorted.map((item) => item.label)
    },
    series: [
      {
        type: "bar",
        data: sorted.map((item) => item.count),
        itemStyle: { color: "#5470c6" },
        label: { show: true, position: "right", fontSize: 10 }
      }
    ]
  };
}

function buildChromBarOption(data: LabelCount[]): EChartsOption {
  return {
    grid: { left: 48, right: 24, top: 16, bottom: 52 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      axisLabel: { rotate: 40, fontSize: 10 },
      data: data.map((item) => item.label)
    },
    yAxis: { type: "value", name: "Variants" },
    series: [
      {
        type: "bar",
        data: data.map((item) => item.count),
        itemStyle: { color: "#73c0de" }
      }
    ]
  };
}

function buildCompareOption(
  breastData: LabelCount[],
  colonData: LabelCount[]
): EChartsOption {
  const top20 = Array.from(
    new Set([...breastData.slice(0, 20).map((d) => d.label), ...colonData.slice(0, 20).map((d) => d.label)])
  ).slice(0, 20);
  const breastMap = new Map(breastData.map((d) => [d.label, d.count]));
  const colonMap = new Map(colonData.map((d) => [d.label, d.count]));
  const sortedGenes = top20.sort(
    (a, b) => (breastMap.get(b) ?? 0) + (colonMap.get(b) ?? 0) - ((breastMap.get(a) ?? 0) + (colonMap.get(a) ?? 0))
  );
  return {
    grid: { left: 60, right: 24, top: 40, bottom: 68 },
    tooltip: { trigger: "axis" },
    legend: { data: ["Breast", "Colonrector"], top: 8 },
    xAxis: {
      type: "category",
      axisLabel: { rotate: 40, fontSize: 10 },
      data: sortedGenes
    },
    yAxis: { type: "value", name: "Variants" },
    series: [
      {
        name: "Breast",
        type: "bar",
        data: sortedGenes.map((g) => breastMap.get(g) ?? 0),
        itemStyle: { color: "#FC812F" }
      },
      {
        name: "Colonrector",
        type: "bar",
        data: sortedGenes.map((g) => colonMap.get(g) ?? 0),
        itemStyle: { color: "#5470c6" }
      }
    ]
  };
}

export function MutationDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const cancer = searchParams.get("cancer") ?? DEFAULT_CANCER;

  const funcQ = useQuery({ queryKey: ["func-dist", cancer], queryFn: () => getFuncDistribution(cancer) });
  const exonicQ = useQuery({ queryKey: ["exonic-dist", cancer], queryFn: () => getExonicDistribution(cancer) });
  const chromQ = useQuery({ queryKey: ["chrom-dist", cancer], queryFn: () => getChromDistribution(cancer) });
  const burdenQ = useQuery({ queryKey: ["sample-burden", cancer], queryFn: () => getSampleBurden(cancer, 20) });
  const breastTopQ = useQuery({ queryKey: ["top-genes", "Breast", 20], queryFn: () => getTopGenes("Breast", 20) });
  const colonTopQ = useQuery({ queryKey: ["top-genes", "Colonrector", 20], queryFn: () => getTopGenes("Colonrector", 20) });

  const changeCancer = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("cancer", value);
    setSearchParams(params);
  };

  const loading = funcQ.isLoading || exonicQ.isLoading || chromQ.isLoading || burdenQ.isLoading;
  const noData = !loading && (funcQ.data?.length === 0);

  return (
    <div className="page-stack">
      <SectionHeader
        eyebrow="Mutation Dashboard"
        title="Multianno variant visualizations"
        description="Interactive charts built directly from the aggregate multianno files via DuckDB. Data currently available for Breast and Colorectal cohorts."
      />

      <section className="filter-panel">
        <label htmlFor="cancer-select" style={{ marginRight: 8, fontWeight: 500 }}>Cohort:</label>
        <select id="cancer-select" value={cancer} onChange={(e) => changeCancer(e.target.value)}>
          {CANCER_OPTIONS.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        {noData && (
          <span className="panel-note" style={{ marginLeft: 16 }}>
            Aggregate multianno file not yet available for {cancer}.
          </span>
        )}
      </section>

      {loading && <p className="panel-note">Loading charts...</p>}

      {/* Row 1: Func distribution (pie) + Exonic distribution (horizontal bar) */}
      {!loading && (
        <div className="chart-row-2col">
          {funcQ.data && funcQ.data.length > 0 && (
            <ChartCard
              title={`${cancer} — Variant functional region`}
              option={buildPieOption(funcQ.data)}
            />
          )}
          {exonicQ.data && exonicQ.data.length > 0 && (
            <ChartCard
              title={`${cancer} — Exonic mutation type`}
              option={buildHBarOption(exonicQ.data, "Variants")}
            />
          )}
        </div>
      )}

      {/* Row 2: Chromosome distribution (vertical bar) */}
      {chromQ.data && chromQ.data.length > 0 && (
        <ChartCard
          title={`${cancer} — Variants per chromosome`}
          option={buildChromBarOption(chromQ.data)}
        />
      )}

      {/* Row 3: Sample mutation burden (horizontal bar, top 20) */}
      {burdenQ.data && burdenQ.data.length > 0 && (
        <ChartCard
          title={`${cancer} — Top 20 samples by mutation burden`}
          option={buildHBarOption(burdenQ.data, "Variants")}
        />
      )}

      {/* Row 4: Cancer comparison (grouped bar, Breast vs Colonrector) */}
      {breastTopQ.data && colonTopQ.data &&
        breastTopQ.data.length > 0 && colonTopQ.data.length > 0 && (
          <section className="page-stack compact-gap">
            <SectionHeader
              eyebrow="Cross-cohort comparison"
              title="Breast vs Colorectal — top mutated genes"
            />
            <ChartCard
              title="Breast vs Colonrector top gene comparison"
              option={buildCompareOption(
                breastTopQ.data.map((d) => ({ label: d.gene, count: d.count })),
                colonTopQ.data.map((d) => ({ label: d.gene, count: d.count }))
              )}
            />
          </section>
        )}
    </div>
  );
}
