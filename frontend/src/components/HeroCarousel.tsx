import { lazy, Suspense, type CSSProperties, type FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import { useNavigate } from "react-router-dom";
import { getCancerSummary, getSourceDistribution, getStatisticsOverview } from "../api/client";
import type { CancerSummary } from "../types/api";
import { formatNumber } from "../utils/format";
import humanBodyImg from "../assets/body_simple_man.png";
import tutorialImg from "../assets/ctdnadb.png";
import "../styles/home.css";

const ReactECharts = lazy(() => import("echarts-for-react"));

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
  sourceSamples: ["#143d79", "#1d56a7", "#2872cf", "#4b90df", "#75afe9", "#a7cff2"],
  cancerSamples: ["#8a2d12", "#a83816", "#bf481d", "#d95d24", "#ed782f", "#f08f47", "#f3a862", "#d26d2f", "#b64a1c"],
  annotated: ["#0f5a43", "#137253", "#178a65", "#1fa078", "#33b18b", "#53bd9d", "#73c9ae", "#2f8f73", "#1b765c"],
  mutations: ["#4C1D95", "#5B21B6", "#6D28D9", "#7C3AED", "#8B5CF6", "#9668E8", "#7E54D2", "#6542B4", "#52329A"],
} as const;

const COHORT_PRIORITY = ["Breast", "Colorectal", "Lung", "Liver", "Pancreatic"] as const;

const SOURCE_RING_ORDER = ["internal", "public", "tcga"] as const;

const SOURCE_RING_LABELS: Record<typeof SOURCE_RING_ORDER[number], { label: string; browseSource: string }> = {
  internal: { label: "Collected Samples", browseSource: "cfDNA" },
  public: { label: "Public Cohort", browseSource: "Public" },
  tcga: { label: "TCGA", browseSource: "tcga" },
};

const HOME_STATS_CACHE_MS = 30 * 60_000;

const COHORT_DISPLAY_LABELS: Record<string, string> = {
  HeadAndNeck: "Head & Neck",
  Benign_Tumor: "Benign Tumor",
  Cell_Line: "Gastric",
};

const BODY_CALLOUT_SAMPLE_COUNTS: Record<string, number> = {
  Bladder: 429,
  Brain: 13,
  Breast: 1490,
  Cervical: 294,
  Colorectal: 729,
  Endometrial: 520,
  Esophageal: 187,
  Gastric: 562,
  HeadAndNeck: 524,
  Kidney: 400,
  Liver: 460,
  Lung: 1268,
  Ovarian: 823,
  Pancreatic: 227,
  Thyroid: 504,
  Benign_Tumor: 66,
  Healthy: 1428,
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

function formatPercent(value: number, total: number) {
  if (!Number.isFinite(total) || total <= 0) return "0.0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function formatDistributionLabel(label: string) {
  const normalized = label.replace(/_/g, " ").trim();
  if (/^UTR3$/i.test(normalized)) return "UTR";
  if (!normalized) return label;
  return normalized
    .split(/\s+/)
    .map((word) => {
      if (/^utr\d+/i.test(word)) return word.toUpperCase();
      if (word.toUpperCase() === word) return word;
      if (/[A-Z]/.test(word.slice(1))) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function normalizeSourceKey(source: string): typeof SOURCE_RING_ORDER[number] | "" {
  const normalized = source.trim().toLowerCase();
  if (normalized === "private" || normalized === "internal" || normalized === "cfdna") return "internal";
  if (normalized === "public" || normalized === "geo") return "public";
  if (normalized === "tcga") return "tcga";
  return "";
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
  showConnector?: boolean;
  count?: number;
};

const ALL_CALLOUTS = [
  /* ── left side (top → bottom) ── */
  { id: "HeadAndNeck", label: "Head & Neck Cancer", side: "left", labelTopPct: 14, labelXPct: 8.5, pointXPct: 42.5, pointYPct: 19, browseKey: "HeadAndNeck" },
  { id: "Thyroid", label: "Thyroid Cancer", side: "left", labelTopPct: 21.5, labelXPct: 8.5, pointXPct: 42.5, pointYPct: 21.5, browseKey: "Thyroid" },
  { id: "Lung", label: "Lung Cancer", side: "left", labelTopPct: 34.5, labelXPct: 8.5, pointXPct: 39.4, pointYPct: 31, browseKey: "Lung" },
  { id: "Esophageal", label: "Esophageal Cancer", side: "left", labelTopPct: 28, labelXPct: 8.5, pointXPct: 42.5, pointYPct: 24.5, browseKey: "Esophageal" },
  { id: "Liver", label: "Liver Cancer", side: "left", labelTopPct: 42, labelXPct: 8.5, pointXPct: 40.6, pointYPct: 38.8, browseKey: "Liver" },
  { id: "Pancreatic", label: "Pancreatic Cancer", side: "left", labelTopPct: 50.5, labelXPct: 8.5, pointXPct: 43.8, pointYPct: 42.8, browseKey: "Pancreatic" },
  { id: "Colorectal", label: "Colorectal Cancer", side: "left", labelTopPct: 60.5, labelXPct: 8.5, pointXPct: 49.4, pointYPct: 48.8, browseKey: "Colorectal" },
  { id: "Bladder", label: "Bladder Cancer", side: "left", labelTopPct: 71, labelXPct: 8.5, pointXPct: 42.6, pointYPct: 56.2, browseKey: "Bladder" },
  { id: "Healthy", label: "Healthy", side: "left", labelTopPct: 82, labelXPct: 8.5, pointXPct: 0, pointYPct: 0, browseKey: "Healthy", showConnector: false },
  /* ── right side (top → bottom) ── */
  { id: "Brain", label: "Brain Cancer", side: "right", labelTopPct: 14, labelXPct: 91.5, pointXPct: 42.5, pointYPct: 14, browseKey: "Brain" },
  { id: "Breast", label: "Breast Cancer", side: "right", labelTopPct: 24, labelXPct: 91.5, pointXPct: 64.5, pointYPct: 34.2, browseKey: "Breast" },
  { id: "Gastric", label: "Gastric Cancer", side: "right", labelTopPct: 34, labelXPct: 91.5, pointXPct: 46, pointYPct: 41, browseKey: "Gastric" },
  { id: "Kidney", label: "Kidney Cancer", side: "right", labelTopPct: 41, labelXPct: 91.5, pointXPct: 48.4, pointYPct: 42.4, browseKey: "Kidney" },
  { id: "Cervical", label: "Cervical Cancer", side: "right", labelTopPct: 59, labelXPct: 91, pointXPct: 59.3, pointYPct: 58, browseKey: "Cervical" },
  { id: "Endometrial", label: "Endometrial Cancer", side: "right", labelTopPct: 50, labelXPct: 91.5, pointXPct: 59.3, pointYPct: 55.1, browseKey: "Endometrial" },
  { id: "Ovarian", label: "Ovarian Cancer", side: "right", labelTopPct: 68, labelXPct: 91.5, pointXPct: 62.8, pointYPct: 55, browseKey: "Ovarian" },
  { id: "Benign_Tumor", label: "Benign Tumor", side: "right", labelTopPct: 82, labelXPct: 91.5, pointXPct: 0, pointYPct: 0, browseKey: "Benign_Tumor", showConnector: false },
] as const satisfies readonly BodyCalloutConfig[];

function getLabelCenterX(cfg: BodyCalloutConfig) {
  return cfg.labelXPct ?? (cfg.side === "left" ? 14 : 86);
}

function getPointX(cfg: BodyCalloutConfig) {
  if (cfg.showConnector === false) return cfg.pointXPct;
  return cfg.pointXPct;
}

function buildCalloutPolyline(cfg: BodyCalloutConfig) {
  const labelCenterX = getLabelCenterX(cfg);
  const labelEdgeX = cfg.side === "left" ? labelCenterX + 10 : labelCenterX - 10;
  const pointX = getPointX(cfg);
  const elbowX = labelEdgeX + (pointX - labelEdgeX) * 0.45;
  return `${labelEdgeX},${cfg.labelTopPct} ${elbowX},${cfg.labelTopPct} ${elbowX},${cfg.pointYPct} ${pointX},${cfg.pointYPct}`;
}

type HeroRingEntry = { 
  id: string;
  label: string;
  value: number;
  browseKey: string;
};

function formatCompactCount(value: number) {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${Number.isInteger(millions) ? millions.toFixed(0) : millions.toFixed(1).replace(/\\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    const thousands = value / 1_000;
    return `${Number.isInteger(thousands) ? thousands.toFixed(0) : thousands.toFixed(1).replace(/\\.0$/, "")}K`;
  }
  return formatNumber(value);
}

function buildSunburstEntries(
  entries: HeroRingEntry[],
  palette: readonly string[],
) {
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  return sorted.map((entry, idx) => ({
    name: entry.label,
    value: entry.value,
    browseKey: entry.browseKey,
    itemStyle: { color: palette[idx % palette.length] },
  }));
}

function buildHeroSunburstOption(
  title: string,
  total: number,
  entries: HeroRingEntry[],
  palette: readonly string[],
  centerTitle: string,
  centerValue: string,
  centerColor?: string,
  minAngle = 15,
): EChartsOption {
  const isVariantCountChart = title === "Genome distribution" || title === "Variant Types";
  const children = buildSunburstEntries(entries, palette);
  const formatValue = (value: number) => (isVariantCountChart ? formatCompactCount(value) : formatNumber(value));

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
        radius: [0, "36%"],
        center: ["50%", "50%"],
        silent: true,
        tooltip: {
          show: false,
        },
        label: {
          position: "center",
          formatter: `{title|${centerTitle}}\n{value|${centerValue}}`,
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
              fontSize: isVariantCountChart ? 10 : 12,
              align: "center",
              lineHeight: 14,
            },
          },
        },
        labelLine: {
          show: false,
        },
        itemStyle: {
          color: centerColor ?? palette[1] ?? palette[0],
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
        radius: ["39%", "94%"],
        center: ["50%", "50%"],
        startAngle: 180,
        sort: undefined,
        clockwise: true,
        minAngle,
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
            const pct = formatPercent(value, total);
            if (!params.name) return "";
            return formatRingLabel(params.name, pct);
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
  palette,
  centerTitle,
  centerValue,
  centerColor,
  minAngle,
  onSliceClick,
}: {
  title: string;
  total: number;
  entries: HeroRingEntry[];
  palette: readonly string[];
  centerTitle: string;
  centerValue: string;
  centerColor?: string;
  minAngle?: number;
  onSliceClick: (browseKey: string) => void;
}) {
  const option = useMemo(
    () => buildHeroSunburstOption(title, total, entries, palette, centerTitle, centerValue, centerColor, minAngle),
    [centerColor, centerTitle, centerValue, entries, minAngle, palette, title, total],
  );

  return (
    <article className="gdc-overview-chart" aria-label={title}>
      <h3 className="gdc-overview-chart-title">{title}</h3>
      <div className="gdc-overview-chart-shell">
        <Suspense fallback={<p className="panel-note">Loading chart...</p>}>
          <ReactECharts
            key={`${title}-${total}`}
            option={option}
            notMerge
            lazyUpdate={false}
            style={{ height: "var(--gdc-overview-chart-size)", width: "100%" }}
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
        </Suspense>
      </div>
    </article>
  );
}

export function HeroCarousel() {
  const navigate = useNavigate();
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [quickGene, setQuickGene] = useState("");
  const cancerQuery = useQuery({
    queryKey: ["cancer-summary"],
    queryFn: getCancerSummary,
    placeholderData: MOCK_COHORTS,
    staleTime: HOME_STATS_CACHE_MS,
    gcTime: HOME_STATS_CACHE_MS,
  });
  const sourceQuery = useQuery({
    queryKey: ["source-distribution", "all"],
    queryFn: () => getSourceDistribution(),
    staleTime: HOME_STATS_CACHE_MS,
    gcTime: HOME_STATS_CACHE_MS,
  });
  const overviewQuery = useQuery({
    queryKey: ["statistics-overview"],
    queryFn: getStatisticsOverview,
    staleTime: HOME_STATS_CACHE_MS,
    gcTime: HOME_STATS_CACHE_MS,
  });
  const cohorts = cancerQuery.data?.length ? cancerQuery.data : MOCK_COHORTS;
  const sourceDistribution = sourceQuery.data ?? [];
  const overview = overviewQuery.data;
  const countMap = BODY_CALLOUT_SAMPLE_COUNTS;
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
  const genomeDistribution = overview?.funcDistribution ?? [];
  const variantClassDistribution = overview?.exonicDistribution ?? [];
  const totalGenomeDistribution = useMemo(
    () => genomeDistribution.reduce((sum, entry) => sum + entry.count, 0),
    [genomeDistribution],
  );
  const totalVariantClassification = useMemo(
    () => variantClassDistribution.reduce((sum, entry) => sum + entry.count, 0),
    [variantClassDistribution],
  );
  const visibleCallouts = ALL_CALLOUTS;
  const genomeRingEntries = useMemo(
    () => genomeDistribution.map((entry, index) => ({
      id: `genome-${index}-${entry.label}`,
      label: formatDistributionLabel(entry.label),
      value: entry.count,
      browseKey: "",
    })),
    [genomeDistribution],
  );
  const variantClassRingEntries = useMemo(
    () => variantClassDistribution.map((entry, index) => ({
      id: `variant-class-${index}-${entry.label}`,
      label: formatDistributionLabel(entry.label),
      value: entry.count,
      browseKey: "",
    })),
    [variantClassDistribution],
  );
  const overviewCards = useMemo(
    () => [
      {
        id: "source-samples",
        title: "Source samples",
        total: totalSourceSamples,
        entries: sourceRingEntries,
        palette: RING_PALETTES.sourceSamples,
        centerTitle: "Samples",
        centerValue: formatNumber(totalSourceSamples),
        minAngle: 30,
      },
      {
        id: "cancer-samples",
        title: "Cancer Types",
        total: totalSamples,
        entries: sampleRingEntries,
        palette: RING_PALETTES.cancerSamples,
        centerTitle: "Collected\nSamples",
        centerValue: formatNumber(totalSamples),
        minAngle: 21,
      },
      {
        id: "genome-distribution",
        title: "Genome distribution",
        total: totalGenomeDistribution,
        entries: genomeRingEntries,
        palette: RING_PALETTES.annotated,
        centerTitle: "Locations",
        centerValue: formatCompactCount(totalGenomeDistribution),
        minAngle: 20,
      },
      {
        id: "variant-classification",
        title: "Variant Types",
        total: totalVariantClassification,
        entries: variantClassRingEntries,
        palette: RING_PALETTES.mutations,
        centerTitle: "Variants",
        centerValue: formatCompactCount(totalVariantClassification),
        centerColor: "#A78BFA",
        minAngle: 30,
      },
    ],
    [genomeRingEntries, sampleRingEntries, sourceRingEntries, totalGenomeDistribution, totalSamples, totalSourceSamples, totalVariantClassification, variantClassRingEntries],
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

  const submitQuickSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const gene = quickGene.trim();
    navigate(gene ? `/gene-search?gene=${encodeURIComponent(gene)}` : "/gene-search");
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
                ctDNA Database provides a comprehensive resource for plasma circulating tumor DNA somatic mutation profiles across multiple cancer types generated by high-throughput sequencing and collected from <span className="gdc-subtitle-keyword">more than 10 hospitals across multi-center cohorts</span>, covering <span className="gdc-subtitle-stat">9,924 samples</span> (<span className="gdc-subtitle-stat">6,618 publicly available</span> and <span className="gdc-subtitle-stat">3,306 collected</span>), <span className="gdc-subtitle-stat gdc-subtitle-stat--variant">51,099,363 variants</span>, and <span className="gdc-subtitle-stat">16 cancer types</span>. It classifies <span className="gdc-subtitle-stat gdc-subtitle-stat--variant">48,535,909 variants</span> with mapped genomic locations, including <span className="gdc-subtitle-term">23,901,156 intergenic</span>, <span className="gdc-subtitle-term">17,771,249 intronic</span>, <span className="gdc-subtitle-term">2,217,583 exonic</span>, and <span className="gdc-subtitle-term">646,446 UTR variants</span>, and annotates <span className="gdc-subtitle-stat gdc-subtitle-stat--mutation">2,499,460 non-synonymous mutations</span>, including <span className="gdc-subtitle-term">2,231,182 missense</span>, <span className="gdc-subtitle-term">126,633 nonsense</span>, <span className="gdc-subtitle-term">15,167 frameshift deletion</span>, and <span className="gdc-subtitle-term">113,284 frameshift insertion</span> events. The database supports integrated analyses of <span className="gdc-subtitle-keyword">somatic mutations</span>, <span className="gdc-subtitle-keyword">variant allele frequency (VAF)</span>, <span className="gdc-subtitle-keyword">oncoplots</span>, <span className="gdc-subtitle-keyword">transition/transversion (Ti/Tv) patterns</span>, and <span className="gdc-subtitle-keyword">survival outcomes</span>, while also incorporating <span className="gdc-subtitle-keyword">DNA methylation</span>, <span className="gdc-subtitle-keyword">circulating tumor cells (CTCs)</span>, <span className="gdc-subtitle-keyword">histone modifications</span>, and <span className="gdc-subtitle-keyword">nucleosome positioning</span> to help assess the functional effects of mutated genes.
              </p>
            </div>

            <div className="gdc-quick-panel">
              <form className="gdc-quick-search" onSubmit={submitQuickSearch}>
                <label htmlFor="home-quick-gene">Quick Search</label>
                <div className="gdc-quick-search-row">
                  <input
                    id="home-quick-gene"
                    value={quickGene}
                    onChange={(event) => setQuickGene(event.target.value)}
                    placeholder="TP53, KRAS, PIK3CA..."
                    autoComplete="off"
                  />
                  <button type="submit">Search</button>
                </div>
              </form>
            </div>
          </div>

          <div className="gdc-col-middle">
            <div className="gdc-hero-stat-panel">
              <div className="gdc-overview-grid gdc-overview-grid--hero">
                {overviewCards.map((card) => (
                  <HeroRingChart
                    key={card.id}
                    title={card.title}
                    total={card.total}
                    entries={card.entries}
                    palette={card.palette}
                    centerTitle={card.centerTitle}
                    centerValue={card.centerValue}
                    centerColor={card.centerColor}
                    minAngle={card.minAngle}
                    onSliceClick={goToOverviewSlice}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="gdc-stat-section">
        <div className="gdc-stat-inner">
          <article className="gdc-stat-card gdc-stat-card--body">
            <div className="gdc-card-head">
              <p className="section-eyebrow">Statistic</p>
            </div>
            <div className="body-map body-map--stat">
              <div className="body-map-stage">
                <img src={humanBodyImg} alt="Human body diagram with cancer sites" className="gdc-body-img" loading="eager" decoding="async" />

                {visibleCallouts.map((cfg) => (
                  <div key={cfg.id} className={`body-callout body-callout--${cfg.side}`}>
                    {cfg.showConnector === false ? null : (
                      <svg className="callout-connector" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                        <polyline points={buildCalloutPolyline(cfg)} />
                      </svg>
                    )}

                    {cfg.showConnector === false ? null : (
                      <div
                        className="callout-dot"
                        style={{ left: `${getPointX(cfg)}%`, top: `${cfg.pointYPct}%` } as CSSProperties}
                        aria-hidden="true"
                      />
                    )}

                    <button
                      type="button"
                      className={`callout-label callout-label--${cfg.side}`}
                      style={{ top: `${cfg.labelTopPct}%`, left: `${getLabelCenterX(cfg)}%` } as CSSProperties}
                      onClick={() => goToBrowse(cfg.browseKey)}
                      aria-label={`Browse ${cfg.label} cohort`}
                    >
                      <strong>{cfg.label}</strong>
                      <span>{formatNumber(cfg.count ?? countMap[cfg.id] ?? 0)}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="gdc-index-card">
            <div className="gdc-card-head">
              <p className="section-eyebrow">Tutorial</p>
            </div>
            <div className="gdc-tutorial-panel">
              <button
                type="button"
                className="gdc-tutorial-zoom"
                onClick={() => setIsTutorialOpen(true)}
                aria-label="Enlarge ctDNAdb tutorial workflow"
              >
                <img src={tutorialImg} alt="ctDNAdb tutorial workflow" loading="lazy" decoding="async" />
              </button>
            </div>
          </article>
        </div>
      </section>

      {isTutorialOpen ? (
        <div
          className="gdc-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="ctDNAdb tutorial workflow"
          onClick={() => setIsTutorialOpen(false)}
        >
          <button
            type="button"
            className="gdc-lightbox-close"
            onClick={(event) => {
              event.stopPropagation();
              setIsTutorialOpen(false);
            }}
          >
            Close
          </button>
          <div className="gdc-lightbox-frame" onClick={(event) => event.stopPropagation()}>
            <img src={tutorialImg} alt="ctDNAdb tutorial workflow enlarged" decoding="async" />
          </div>
        </div>
      ) : null}

    </>
  );
}
