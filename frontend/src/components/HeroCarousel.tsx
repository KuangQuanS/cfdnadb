import { type CSSProperties, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { Link, useNavigate } from "react-router-dom";
import { getCancerSummary, getSourceDistribution } from "../api/client";
import type { CancerSummary } from "../types/api";
import { formatNumber } from "../utils/format";
import humanBodyImg from "../assets/body_simple_nohand.png";
import indexMutectImg from "../assets/index_mutect.png";
import tutorialImg from "../assets/tutorial.png";
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
  sourceSamples: ["#173b68", "#23589c", "#2d74cc", "#458ddb", "#62a1e3", "#7eb3ea"],
  cancerSamples: ["#1a4f7a", "#1d5b8c", "#2168a0", "#277ebf", "#2e92db", "#4aa3e0", "#6ab3e5", "#8dc2eb"],
  annotated: ["#176146", "#1c7353", "#228a63", "#29a376", "#32c28c", "#4ed1a0", "#6fdcb6", "#90e6ca"],
  mutations: ["#0f5a43", "#137356", "#188c68", "#1ca379", "#22c28f", "#44d1a4", "#6adbb6", "#8de5c6"],
} as const;

const OTHER_SLICE_COLOR = "#dce2e8";

const COHORT_PRIORITY = ["Breast", "Colorectal", "Lung", "Liver", "Pancreatic"] as const;

const INTRO_TOTAL_SAMPLES = 3293;
const INTRO_TOTAL_FILES = 8995;
const INTRO_TOTAL_MUTATIONS = 48403074;

const SOURCE_RING_ORDER = ["internal", "public", "tcga"] as const;

const SOURCE_RING_LABELS: Record<typeof SOURCE_RING_ORDER[number], { label: string; browseSource: string }> = {
  internal: { label: "Internal Data", browseSource: "cfDNA" },
  public: { label: "Public Cohorts", browseSource: "Public" },
  tcga: { label: "TCGA", browseSource: "tcga" },
};

const HERO_ACTIONS = [
  { label: "Gene Search", to: "/gene-search", icon: "gene" },
  { label: "Survival Analysis", to: "/survival", icon: "survival" },
  { label: "Downloads", to: "/downloads", icon: "download" },
  { label: "Tutorials", to: "/help", icon: "tutorial" },
] as const;

type HeroActionIcon = typeof HERO_ACTIONS[number]["icon"];

const COHORT_DISPLAY_LABELS: Record<string, string> = {
  HeadAndNeck: "Head & Neck",
  Benign_Tumor: "Benign Tumor",
  Cell_Line: "Gastric",
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

function normalizeSourceKey(source: string): typeof SOURCE_RING_ORDER[number] | "" {
  const normalized = source.trim().toLowerCase();
  if (normalized === "private" || normalized === "internal" || normalized === "cfdna") return "internal";
  if (normalized === "public" || normalized === "geo") return "public";
  if (normalized === "tcga") return "tcga";
  return "";
}

function HeroIcon({ icon }: { icon: HeroActionIcon }) {
  if (icon === "gene") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.26 3.27A6.6 6.6 0 0 1 12 3c1.86 0 3.5.76 4.67 2.02" />
        <path d="M18.8 8.41a6.6 6.6 0 0 1-.36 9.87" />
        <path d="M15.4 20.63a6.6 6.6 0 0 1-9.86.04" />
        <path d="M4.6 15.6A6.6 6.6 0 0 1 5.05 5.5" />
        <path d="m6.5 13 4 4" />
        <path d="m13.5 17 4-4" />
        <path d="m17.5 11-4-4" />
        <path d="m10.5 7-4 4" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    );
  }

  if (icon === "survival") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="m19 9-5 5-4-4-3 3" />
        <path d="M21 6h-6v6" />
      </svg>
    );
  }

  if (icon === "download") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" x2="12" y1="15" y2="3" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

type BodyCalloutConfig = {
  id: string;
  label: string;
  side: "left" | "right";
  /* Percent coordinates are relative to the body-map box.
     labelXPct/labelTopPct move the pill; pointXPct/pointYPct move the organ dot. */
  labelTopPct: number;
  labelXPct?: number;
  pointXPct: number;
  pointYPct: number;
  browseKey: string;
};

const ALL_CALLOUTS = [
  /* ── left side (top → bottom) ── */
  { id: "HeadAndNeck", label: "Head & Neck", side: "left", labelTopPct: 14, labelXPct: 14, pointXPct: 60, pointYPct: 14, browseKey: "HeadAndNeck" },
  { id: "Lung", label: "Lung", side: "left", labelTopPct: 24.5, labelXPct: 14, pointXPct: 56, pointYPct: 28.8, browseKey: "Lung" },
  { id: "Liver", label: "Liver", side: "left", labelTopPct: 34.2, labelXPct: 14, pointXPct: 56, pointYPct: 37.3, browseKey: "Liver" },
  { id: "Pancreatic", label: "Pancreas", side: "left", labelTopPct: 43.6, labelXPct: 14, pointXPct: 55.5, pointYPct: 39.6, browseKey: "Pancreatic" },
  { id: "Endometrial", label: "Endometrial", side: "left", labelTopPct: 53, labelXPct: 14, pointXPct: 59.5, pointYPct: 53, browseKey: "Endometrial" },
  { id: "Bladder", label: "Bladder", side: "left", labelTopPct: 66.8, labelXPct: 14, pointXPct: 59.7, pointYPct: 55.6, browseKey: "Bladder" },
  /* ── right side (top → bottom) ── */
  { id: "Breast", label: "Breast", side: "right", labelTopPct: 26.0, labelXPct: 86, pointXPct: 68, pointYPct: 33, browseKey: "Breast" },
  { id: "Gastric", label: "Gastric", side: "right", labelTopPct: 35.2, labelXPct: 86, pointXPct: 64, pointYPct: 39.5, browseKey: "Gastric" },
  { id: "Kidney", label: "Kidney", side: "right", labelTopPct: 44.2, labelXPct: 86, pointXPct: 67.5, pointYPct: 41, browseKey: "Kidney" },
  { id: "Colorectal", label: "Colorectal", side: "right", labelTopPct: 54.8, labelXPct: 86, pointXPct: 67.5, pointYPct: 46.8, browseKey: "Colorectal" },
  { id: "Ovarian", label: "Ovarian", side: "right", labelTopPct: 66.0, labelXPct: 86, pointXPct: 65, pointYPct: 53.2, browseKey: "Ovarian" },
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
          style={{ height: 280, width: "100%" }}
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
  const sourceQuery = useQuery({ queryKey: ["source-distribution", "all"], queryFn: () => getSourceDistribution(), staleTime: 5 * 60_000 });
  const cohorts = cancerQuery.data?.length ? cancerQuery.data : MOCK_COHORTS;
  const sourceDistribution = sourceQuery.data ?? [];
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
  const sampleRingEntries = useMemo(
    () => ringEntries.map(({ id, label, sampleCount }) => ({ id, label, value: sampleCount, browseKey: id === "Healthy" ? "" : id })),
    [ringEntries],
  );
  const sourceRingEntries = useMemo(
    () => {
      const counts = new Map<typeof SOURCE_RING_ORDER[number], number>(SOURCE_RING_ORDER.map((source) => [source, 0]));
      for (const item of sourceDistribution) {
        const key = normalizeSourceKey(item.label);
        if (key) {
          counts.set(key, (counts.get(key) ?? 0) + item.count);
        }
      }
      return SOURCE_RING_ORDER.map((source) => {
        const config = SOURCE_RING_LABELS[source];
        return {
          id: source,
          label: config.label,
          value: counts.get(source) ?? 0,
          browseKey: `source:${config.browseSource}`,
        };
      }).filter((entry) => entry.value > 0);
    },
    [sourceDistribution],
  );
  const totalSourceSamples = useMemo(
    () => sourceRingEntries.reduce((sum, entry) => sum + entry.value, 0),
    [sourceRingEntries],
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
        id: "source-samples",
        title: "Source samples",
        total: totalSourceSamples,
        entries: sourceRingEntries,
        caption: "Curated samples grouped by Internal Data, Public Cohorts, and TCGA.",
        palette: RING_PALETTES.sourceSamples,
      },
      {
        id: "cancer-samples",
        title: "Sample categories",
        total: totalSamples,
        entries: sampleRingEntries,
        caption: "Curated plasma samples grouped by cohort category.",
        palette: RING_PALETTES.cancerSamples,
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
    [annotatedRingEntries, mutationRingEntries, sampleRingEntries, sourceRingEntries, totalAnnotated, totalMutations, totalSamples, totalSourceSamples],
  );

  const goToBrowse = (browseKey: string) => {
    navigate(`/browse?cancer=${encodeURIComponent(browseKey)}&source=cfDNA`);
  };

  const goToOverviewSlice = (browseKey: string) => {
    if (browseKey.startsWith("source:")) {
      navigate(`/browse?source=${encodeURIComponent(browseKey.slice("source:".length))}`);
      return;
    }
    goToBrowse(browseKey);
  };

  return (
    <>
      <section className="gdc-hero">
        <div className="gdc-hero-inner gdc-hero-inner--intro">
          <div className="gdc-col-left">
            <h1 className="gdc-title">Welcome to <span>ctDNAdb</span></h1>
            <div className="gdc-title-rule" aria-hidden="true" />
            <div className="gdc-subtitle">
              <p>
                ctDNAdb represents a comprehensive plasma circulating tumor DNA somatic mutation resource encompassing <strong>{formatNumber(INTRO_TOTAL_SAMPLES)}</strong> curated samples across major cancer cohorts, including <strong>breast, colorectal, gastric, liver, lung, pancreatic, head and neck, kidney, and ovarian malignancies</strong>.
              </p>
              <p>
                The database integrates cohort-level sample metadata, annotated variant profiles, and downloadable analysis resources, currently comprising <strong>{formatNumber(INTRO_TOTAL_FILES)}</strong> data files, functional annotations, and <strong>{formatNumber(INTRO_TOTAL_MUTATIONS)}</strong> imported mutation records.
              </p>
              <p>
                The platform provides anatomical browsing, sample exploration, gene-oriented querying, cohort statistics, visualization modules, and download workflows to support cross-cohort comparison, cohort-level interpretation, and biomarker-focused liquid biopsy research.
              </p>
            </div>

            <nav className="gdc-hero-actions-grid" aria-label="Primary ctDNAdb tools">
              {HERO_ACTIONS.map((action) => (
                <Link key={action.to} to={action.to} className="gdc-hero-action-card">
                  <div className="gdc-hero-action-card-icon">
                    <HeroIcon icon={action.icon} />
                  </div>
                  <div className="gdc-hero-action-card-content">
                    <span className="gdc-hero-action-card-title">{action.label}</span>
                  </div>
                </Link>
              ))}
            </nav>
          </div>

          <div className="gdc-col-middle">
            <div className="body-map">
              <img src={humanBodyImg} alt="Human body diagram with cancer sites" className="gdc-body-img" />

              {visibleCallouts.map((cfg) => (
                <div key={cfg.id} className={`body-callout body-callout--${cfg.side}`}>
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
            </div>
          </div>
        </div>
      </section>

      <section className="gdc-stat-section">
        <div className="gdc-stat-inner">
          <article className="gdc-index-card">
            <div className="gdc-card-head">
              <p className="section-eyebrow">Tutorial</p>
            </div>
            <div className="gdc-tutorial-panel">
              <img src={tutorialImg} alt="ctDNAdb tutorial workflow" />
            </div>
          </article>

          <article className="gdc-stat-card">
            <div className="gdc-card-head">
              <p className="section-eyebrow">Statistic</p>
            </div>
            <div className="gdc-overview-grid">
              {overviewCards.map((card) => (
                <HeroRingChart
                  key={card.id}
                  title={card.title}
                  total={card.total}
                  entries={card.entries}
                  caption={card.caption}
                  palette={card.palette}
                  onSliceClick={goToOverviewSlice}
                />
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="gdc-pipeline-section">
        <div className="gdc-pipeline-inner">
          <div className="gdc-card-head">
            <p className="section-eyebrow">Pipeline</p>
          </div>
          <div className="gdc-pipeline-frame">
            <img src={indexMutectImg} alt="ctDNAdb mutation analysis workflow" />
          </div>
        </div>
      </section>
    </>
  );
}
