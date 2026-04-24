import { type CSSProperties, type FormEvent, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { Link, useNavigate } from "react-router-dom";
import { getCancerSummary } from "../api/client";
import { DEFAULT_GENE } from "../constants/cfdna";
import type { CancerSummary } from "../types/api";
import { formatNumber } from "../utils/format";
import humanBodyImg from "../assets/humanbody_gpt.png";
import "../styles/home.css";

const MOCK_COHORTS: CancerSummary[] = [
  { cancer: "Breast", sampleCount: 486, totalDataFiles: 972, avinputCount: 486, filteredCount: 486, annotatedCount: 486, somaticCount: 0, plotAssetCount: 12, externalAssetCount: 8, mutationCount: 1944000, rawImportStatus: "Completed", filteredStatus: "Completed", annotatedStatus: "Completed", somaticStatus: "Not started", plotStatus: "Completed", externalStatus: "Completed" },
  { cancer: "Colorectal", sampleCount: 352, totalDataFiles: 704, avinputCount: 352, filteredCount: 352, annotatedCount: 352, somaticCount: 0, plotAssetCount: 10, externalAssetCount: 6, mutationCount: 1408000, rawImportStatus: "Completed", filteredStatus: "Completed", annotatedStatus: "Completed", somaticStatus: "Not started", plotStatus: "Completed", externalStatus: "Completed" },
  { cancer: "Liver", sampleCount: 278, totalDataFiles: 556, avinputCount: 278, filteredCount: 278, annotatedCount: 278, somaticCount: 0, plotAssetCount: 8, externalAssetCount: 4, mutationCount: 1112000, rawImportStatus: "Completed", filteredStatus: "Completed", annotatedStatus: "Completed", somaticStatus: "Not started", plotStatus: "Completed", externalStatus: "Completed" },
  { cancer: "Lung", sampleCount: 312, totalDataFiles: 624, avinputCount: 312, filteredCount: 312, annotatedCount: 312, somaticCount: 0, plotAssetCount: 9, externalAssetCount: 5, mutationCount: 1248000, rawImportStatus: "Completed", filteredStatus: "Completed", annotatedStatus: "Completed", somaticStatus: "Not started", plotStatus: "Completed", externalStatus: "Completed" },
  { cancer: "Pancreatic", sampleCount: 99, totalDataFiles: 198, avinputCount: 99, filteredCount: 99, annotatedCount: 99, somaticCount: 0, plotAssetCount: 5, externalAssetCount: 3, mutationCount: 396000, rawImportStatus: "Completed", filteredStatus: "Completed", annotatedStatus: "Completed", somaticStatus: "Not started", plotStatus: "Completed", externalStatus: "Completed" },
  { cancer: "HeadAndNeck", sampleCount: 118, totalDataFiles: 236, avinputCount: 118, filteredCount: 118, annotatedCount: 118, somaticCount: 0, plotAssetCount: 4, externalAssetCount: 2, mutationCount: 472000, rawImportStatus: "Completed", filteredStatus: "Completed", annotatedStatus: "Completed", somaticStatus: "Not started", plotStatus: "Completed", externalStatus: "Completed" },
  { cancer: "Gastric", sampleCount: 144, totalDataFiles: 288, avinputCount: 144, filteredCount: 144, annotatedCount: 144, somaticCount: 0, plotAssetCount: 4, externalAssetCount: 3, mutationCount: 576000, rawImportStatus: "Completed", filteredStatus: "Completed", annotatedStatus: "Completed", somaticStatus: "Not started", plotStatus: "Completed", externalStatus: "Completed" },
  { cancer: "Kidney", sampleCount: 76, totalDataFiles: 152, avinputCount: 76, filteredCount: 76, annotatedCount: 76, somaticCount: 0, plotAssetCount: 3, externalAssetCount: 2, mutationCount: 304000, rawImportStatus: "Completed", filteredStatus: "Completed", annotatedStatus: "Completed", somaticStatus: "Not started", plotStatus: "Completed", externalStatus: "Completed" },
  { cancer: "Ovarian", sampleCount: 92, totalDataFiles: 184, avinputCount: 92, filteredCount: 92, annotatedCount: 92, somaticCount: 0, plotAssetCount: 3, externalAssetCount: 2, mutationCount: 368000, rawImportStatus: "Completed", filteredStatus: "Completed", annotatedStatus: "Completed", somaticStatus: "Not started", plotStatus: "Completed", externalStatus: "Completed" },
];

const RING_PALETTES = {
  samples: ["#26456e", "#3e6a9a", "#5a8ab8", "#7ba5c9", "#9fbddb", "#c2d2e5", "#dde6ef", "#8fa2b8"],
  files: ["#1f5f48", "#36805f", "#53a079", "#79b794", "#a1ccae", "#c5ddc9", "#dfebdf", "#809c8b"],
  annotated: ["#5f2440", "#82405f", "#a3627b", "#be8596", "#d3aab6", "#e3cbd3", "#efdee3", "#9c7786"],
  mutations: ["#7d3b0f", "#a25821", "#c47b3c", "#d79f62", "#e5bf89", "#eed4ac", "#f4e2c6", "#a47c5a"],
} as const;

const OTHER_SLICE_COLOR = "#cfd6dd";

const COHORT_PRIORITY = ["Breast", "Colorectal", "Lung", "Liver", "Pancreatic"] as const;

const INTRO_TOTAL_SAMPLES = 3293;
const INTRO_TOTAL_FILES = 8995;
const INTRO_TOTAL_MUTATIONS = 48403074;

const COHORT_DISPLAY_LABELS: Record<string, string> = {
  HeadAndNeck: "Head & Neck",
  Benign_Tumor: "Benign Tumor",
  Cell_Line: "Cell Line",
};

function formatCohortLabel(cancer: string) {
  return COHORT_DISPLAY_LABELS[cancer] ?? cancer.replace(/_/g, " ");
}

function formatRingLabel(name: string, value: string) {
  const label =
    name === "Head & Neck"
      ? "Head &\nNeck"
      : name.includes(" ")
        ? name.split(/\s+/).join("\n")
        : name;
  return `${label}\n${value}`;
}

type BodyCalloutConfig = {
  id: string;
  label: string;
  side: "left" | "right";
  labelTopPct: number;
  labelXPct?: number;
  pointXPct: number;
  pointYPct: number;
  browseKey: string;
};

const ALL_CALLOUTS = [
  /* ── left side (top → bottom) ── */
  { id: "HeadAndNeck", label: "Head & Neck", side: "left", labelTopPct: 15, labelXPct: 15, pointXPct: 50, pointYPct: 15, browseKey: "HeadAndNeck" },
  { id: "Lung", label: "Lung", side: "left", labelTopPct: 25, pointXPct: 42, pointYPct: 25, browseKey: "Lung" },
  { id: "Liver", label: "Liver", side: "left", labelTopPct: 34.8, pointXPct: 45, pointYPct: 34.8, browseKey: "Liver" },
  { id: "Kidney", label: "Kidney", side: "left", labelTopPct: 44, pointXPct: 43.7, pointYPct: 40.8, browseKey: "Kidney" },
  { id: "Endometrial", label: "Endometrial", side: "left", labelTopPct: 54, pointXPct: 48, pointYPct: 50.5, browseKey: "Endometrial" },
  { id: "Bladder", label: "Bladder", side: "left", labelTopPct: 67, pointXPct: 49, pointYPct: 54.5, browseKey: "Bladder" },
  /* ── right side (top → bottom) ── */
  { id: "Breast", label: "Breast", side: "right", labelTopPct: 26, pointXPct: 58.1, pointYPct: 28, browseKey: "Breast" },
  { id: "Gastric", label: "Gastric", side: "right", labelTopPct: 35.5, pointXPct: 54.6, pointYPct: 35.5, browseKey: "Gastric" },
  { id: "Pancreatic", label: "Pancreas", side: "right", labelTopPct: 44, pointXPct: 48.5, pointYPct: 38.5, browseKey: "Pancreatic" },
  { id: "Colorectal", label: "Colorectal", side: "right", labelTopPct: 55, pointXPct: 58.5, pointYPct: 47, browseKey: "Colorectal" },
  { id: "Ovarian", label: "Ovarian", side: "right", labelTopPct: 66, pointXPct: 52.2, pointYPct: 52.4, browseKey: "Ovarian" },
] as const satisfies readonly BodyCalloutConfig[];

function getLabelCenterX(cfg: BodyCalloutConfig) {
  return cfg.labelXPct ?? (cfg.side === "left" ? 14 : 86);
}

function buildCalloutPolyline(cfg: BodyCalloutConfig) {
  const labelCenterX = getLabelCenterX(cfg);
  const labelEdgeX = cfg.side === "left" ? labelCenterX + 10 : labelCenterX - 10;
  const elbowX = labelEdgeX + (cfg.pointXPct - labelEdgeX) * 0.62;
  return `${labelEdgeX},${cfg.labelTopPct} ${elbowX},${cfg.labelTopPct} ${elbowX},${cfg.pointYPct} ${cfg.pointXPct},${cfg.pointYPct}`;
}

type HeroRingEntry = {
  id: string;
  label: string;
  value: number;
  browseKey: string;
};

function formatMutationValue(value: number) {
  if (value >= 1_000) {
    return `${Math.round(value / 1_000).toLocaleString()}K`;
  }
  return formatNumber(value);
}

function buildSunburstEntries(
  entries: HeroRingEntry[],
  palette: readonly string[],
  limit = 7,
  mergeFromLabel?: string,
) {
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  const mergeFromIndex = mergeFromLabel ? sorted.findIndex((entry) => entry.label === mergeFromLabel) : -1;
  const splitIndex = mergeFromIndex >= 0 ? mergeFromIndex : limit;
  const head = sorted.slice(0, splitIndex);
  const tail = sorted.slice(splitIndex);
  const otherValue = tail.reduce((sum, entry) => sum + entry.value, 0);

  const children = head.map((entry, idx) => ({
    name: entry.label,
    value: entry.value,
    browseKey: entry.browseKey,
    itemStyle: { color: palette[idx % palette.length] },
  }));

  if (otherValue > 0) {
    children.push({
      name: "Other",
      value: otherValue,
      browseKey: "",
      itemStyle: { color: OTHER_SLICE_COLOR },
    });
  }

  return children;
}

function buildHeroSunburstOption(
  title: string,
  total: number,
  entries: HeroRingEntry[],
  palette: readonly string[],
): EChartsOption {
  const isMutations = title === "Mutations";
  const children = buildSunburstEntries(entries, palette, 7, isMutations ? "Bladder" : undefined);
  const formatValue = (value: number) => (isMutations ? formatMutationValue(value) : formatNumber(value));

  return {
    animationDuration: 600,
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(18, 27, 48, 0.94)",
      borderWidth: 0,
      textStyle: {
        color: "#f7fbff",
        fontSize: 12,
      },
      formatter: (params: { name?: string; value?: number }) => {
        const value = params.value ?? 0;
        const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
        return `${params.name}<br/>${formatValue(value)} ${title.toLowerCase()} (${pct}%)`;
      },
    },
    series: [
      {
        type: "pie",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        radius: [0, "44%"],
        center: ["50%", "50%"],
        silent: true,
        tooltip: {
          show: false,
        },
        label: {
          position: "center",
          formatter: `{title|${title}}\n{value|${formatValue(total)}}`,
          rich: {
            title: {
              color: "#ffffff",
              fontWeight: 800,
              fontSize: 12,
              align: "center",
              lineHeight: 16,
            },
            value: {
              color: "#ffffff",
              fontWeight: 800,
              fontSize: isMutations ? 10 : 12,
              align: "center",
              lineHeight: 14,
            },
          },
        },
        labelLine: {
          show: false,
        },
        itemStyle: {
          color: "#1d5f38",
          borderColor: "#ffffff",
          borderWidth: 2,
        },
        data: [{ name: title, value: total }],
      },
      {
        type: "pie",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        radius: ["46%", "94%"],
        center: ["50%", "50%"],
        startAngle: 180,
        sort: undefined,
        clockwise: true,
        minAngle: 30,
        avoidLabelOverlap: false,
        labelLine: {
          show: false,
        },
        itemStyle: {
          borderColor: "#ffffff",
          borderWidth: 2,
        },
        label: {
          position: "inside",
          rotate: "radial",
          color: "#ffffff",
          fontSize: 10,
          lineHeight: 11,
          overflow: "break",
          formatter: (params: { name?: string; value?: number }) => {
            const value = params.value ?? 0;
            if (!params.name || params.name === "Other") {
              return value > 0 ? `Other\n${formatValue(value)}` : "";
            }
            return formatRingLabel(params.name, formatValue(value));
          },
        },
        data: children,
        emphasis: {
          scale: true,
          itemStyle: {
            shadowBlur: 18,
            shadowColor: "rgba(28, 45, 84, 0.18)",
          },
        },
      },
    ],
  };
}

function HeroRingChart({
  title,
  total,
  entries,
  caption,
  palette,
  onSliceClick,
}: {
  title: string;
  total: number;
  entries: HeroRingEntry[];
  caption: string;
  palette: readonly string[];
  onSliceClick: (browseKey: string) => void;
}) {
  const displayTotal = title === "Mutations" ? formatMutationValue(total) : formatNumber(total);
  const option = useMemo(
    () => buildHeroSunburstOption(title, total, entries, palette),
    [entries, palette, title, total],
  );

  return (
    <article className="gdc-overview-chart" aria-label={title}>
      <h3 className="gdc-overview-chart-title">
        {displayTotal} {title}
      </h3>
      <div className="gdc-overview-chart-shell">
        <ReactECharts
          key={`${title}-${total}`}
          option={option}
          notMerge
          lazyUpdate={false}
          style={{ height: 292, width: "100%" }}
          opts={{ renderer: "canvas" }}
          onEvents={{
            click: (params: { data?: { browseKey?: string; name?: string } }) => {
              const browseKey = params.data?.browseKey;
              if (browseKey) {
                onSliceClick(browseKey);
              }
            },
          }}
        />
      </div>
    </article>
  );
}

export function HeroCarousel() {
  const navigate = useNavigate();
  const cancerQuery = useQuery({ queryKey: ["cancer-summary"], queryFn: getCancerSummary, staleTime: 5 * 60_000 });
  const cohorts = cancerQuery.data?.length ? cancerQuery.data : MOCK_COHORTS;
  const countMap = useMemo(
    () => Object.fromEntries(cohorts.map((c) => [c.cancer, c.sampleCount])),
    [cohorts],
  );
  const ringEntries = useMemo(
    () => {
      const priority = new Map(COHORT_PRIORITY.map((name, index) => [name, index]));
      const sorted = [...cohorts].sort((a, b) => {
        const aPriority = priority.get(a.cancer);
        const bPriority = priority.get(b.cancer);
        if (aPriority != null && bPriority != null) return aPriority - bPriority;
        if (aPriority != null) return -1;
        if (bPriority != null) return 1;
        return a.cancer.localeCompare(b.cancer);
      });

      return sorted.map((cohort) => ({
        id: cohort.cancer,
        label: formatCohortLabel(cohort.cancer),
        sampleCount: cohort.sampleCount,
        fileCount: cohort.totalDataFiles,
        annotatedCount: cohort.annotatedCount,
        mutationCount: cohort.mutationCount,
      }));
    },
    [cohorts],
  );
  const totalSamples = useMemo(
    () => ringEntries.reduce((sum, entry) => sum + entry.sampleCount, 0),
    [ringEntries],
  );
  const totalFiles = useMemo(
    () => ringEntries.reduce((sum, entry) => sum + entry.fileCount, 0),
    [ringEntries],
  );
  const sampleRingEntries = useMemo(
    () => ringEntries.map(({ id, label, sampleCount }) => ({ id, label, value: sampleCount, browseKey: id === "Healthy" ? "" : id })),
    [ringEntries],
  );
  const fileRingEntries = useMemo(
    () => ringEntries.map(({ id, label, fileCount }) => ({ id, label, value: fileCount, browseKey: id === "Healthy" ? "" : id })),
    [ringEntries],
  );
  const totalAnnotated = useMemo(
    () => ringEntries.reduce((sum, entry) => sum + entry.annotatedCount, 0),
    [ringEntries],
  );
  const totalMutations = useMemo(
    () => ringEntries.reduce((sum, entry) => sum + entry.mutationCount, 0),
    [ringEntries],
  );
  const visibleCallouts = ALL_CALLOUTS;
  const annotatedRingEntries = useMemo(
    () => ringEntries.map(({ id, label, annotatedCount }) => ({ id, label, value: annotatedCount, browseKey: id })),
    [ringEntries],
  );
  const mutationRingEntries = useMemo(
    () => ringEntries.map(({ id, label, mutationCount }) => ({ id, label, value: mutationCount, browseKey: id })),
    [ringEntries],
  );
  const overviewCards = useMemo(
    () => [
      {
        id: "samples",
        title: "Samples",
        total: totalSamples,
        entries: sampleRingEntries,
        caption: "Cohort distribution of curated plasma samples.",
        palette: RING_PALETTES.samples,
      },
      {
        id: "files",
        title: "Data files",
        total: totalFiles,
        entries: fileRingEntries,
        caption: "Imported mutation and cohort-level source files.",
        palette: RING_PALETTES.files,
      },
      {
        id: "annotated",
        title: "Annotated",
        total: totalAnnotated,
        entries: annotatedRingEntries,
        caption: "Variants with functional annotations per cohort.",
        palette: RING_PALETTES.annotated,
      },
      {
        id: "mutations",
        title: "Mutations",
        total: totalMutations,
        entries: mutationRingEntries,
        caption: "Somatic mutation records per cohort.",
        palette: RING_PALETTES.mutations,
      },
    ],
    [annotatedRingEntries, mutationRingEntries, fileRingEntries, sampleRingEntries, totalAnnotated, totalMutations, totalFiles, totalSamples],
  );

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const gene = fd.get("gene")?.toString().trim() || DEFAULT_GENE;
    navigate(`/gene-search?source=cfDNA&gene=${encodeURIComponent(gene)}`);
  };

  const goToBrowse = (browseKey: string) => {
    navigate(`/browse?cancer=${encodeURIComponent(browseKey)}`);
  };

  return (
    <section className="gdc-hero">
      <div className="gdc-hero-inner">
        <div className="gdc-col-left">
          <h1 className="gdc-title">Welcome to <span>cfDNAdb</span></h1>
          <div className="gdc-title-rule" aria-hidden="true" />
          <div className="gdc-subtitle">
            <p>
              cfDNAdb represents a comprehensive plasma cell-free DNA somatic mutation resource encompassing {formatNumber(INTRO_TOTAL_SAMPLES)} curated samples across major cancer cohorts, including breast, colorectal, gastric, liver, lung, pancreatic, head and neck, kidney, and ovarian malignancies.
            </p>
            <p>
              The database integrates cohort-level sample metadata, annotated variant profiles, and downloadable analysis resources, currently comprising {formatNumber(INTRO_TOTAL_FILES)} data files, functional annotations, and {formatNumber(INTRO_TOTAL_MUTATIONS)} imported mutation records.
            </p>
            <p>
              The platform provides anatomical browsing, sample exploration, gene-oriented querying, cohort statistics, visualization modules, and download workflows to support cross-cohort comparison, cohort-level interpretation, and biomarker-focused liquid biopsy research.
            </p>
          </div>

          <div className="gdc-search-dock gdc-search-dock--inline">
            <form className="gdc-hero-search" onSubmit={handleSearch}>
              <div className="gdc-search-row">
                <input
                  name="gene"
                  type="text"
                  defaultValue={DEFAULT_GENE}
                  placeholder="HGNC symbol, e.g. TP53"
                  aria-label="Enter gene symbol"
                  className="gdc-search-input"
                />
                <button type="submit" className="gdc-search-submit">Search</button>
              </div>
            </form>
          </div>
        </div>

        <div className="gdc-col-middle">
          <div className="body-map">
            <img src={humanBodyImg} alt="Human body diagram with cancer sites" className="gdc-body-img" />

            {visibleCallouts.map((cfg) => (
              <div key={cfg.id} className="body-callout">
                <svg className="callout-connector" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <polyline points={buildCalloutPolyline(cfg)} />
                </svg>

                <div
                  className="callout-dot"
                  style={{ left: `${cfg.pointXPct}%`, top: `${cfg.pointYPct}%` } as CSSProperties}
                  aria-hidden="true"
                />

                <button
                  type="button"
                  className={`callout-label callout-label--${cfg.side}`}
                  style={{ top: `${cfg.labelTopPct}%`, left: `${getLabelCenterX(cfg)}%` } as CSSProperties}
                  onClick={() => goToBrowse(cfg.browseKey)}
                  aria-label={`Browse ${cfg.label} cohort`}
                >
                  <strong>{cfg.label}</strong>
                  <span>{formatNumber(countMap[cfg.id] ?? 0)}</span>
                </button>
              </div>
            ))}
            <Link to="/browse" className="body-map-note">Discover Cohort</Link>
          </div>
        </div>

        <div className="gdc-col-right">
          <div className="gdc-side-rail">
            <div className="gdc-overview-grid">
              {overviewCards.map((card) => (
                <HeroRingChart
                  key={card.id}
                  title={card.title}
                  total={card.total}
                  entries={card.entries}
                  caption={card.caption}
                  palette={card.palette}
                  onSliceClick={goToBrowse}
                />
              ))}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
