import { lazy, Suspense, type CSSProperties, type FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import { useNavigate } from "react-router-dom";
import { getCancerSummary, getSourceDistribution } from "../api/client";
import type { CancerSummary } from "../types/api";
import { formatNumber } from "../utils/format";
import humanBodyImg from "../assets/body_simple_man.png";
import indexMutectImg from "../assets/index_mutect.png";
import tutorialImg from "../assets/tutorial.png";
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
  cancerSamples: ["#8a2d12", "#b9471b", "#df6828", "#f08b3e", "#f5a85f", "#f8c187", "#fbd6ad"],
  annotated: ["#0f5a43", "#16805f", "#20a77c", "#45bf94", "#6ed2ae", "#9de3ca", "#c2eee0"],
  mutations: ["#4b247f", "#6731a7", "#8648c7", "#a66add", "#bf8fec", "#d4b3f3", "#e6d3f8"],
} as const;

const OTHER_SLICE_COLOR = "#6b7280";

const COHORT_PRIORITY = ["Breast", "Colorectal", "Lung", "Liver", "Pancreatic"] as const;

const SOURCE_RING_ORDER = ["internal", "public", "tcga"] as const;

const SOURCE_RING_LABELS: Record<typeof SOURCE_RING_ORDER[number], { label: string; browseSource: string }> = {
  internal: { label: "Internal Data", browseSource: "cfDNA" },
  public: { label: "Public Cohorts", browseSource: "Public" },
  tcga: { label: "TCGA", browseSource: "tcga" },
};

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
          color: palette[1] ?? palette[0],
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
  palette,
  onSliceClick,
}: {
  title: string;
  total: number;
  entries: HeroRingEntry[];
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
        <Suspense fallback={<p className="panel-note">Loading chart...</p>}>
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
        </Suspense>
      </div>
    </article>
  );
}

export function HeroCarousel() {
  const navigate = useNavigate();
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [quickGene, setQuickGene] = useState("");
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
        palette: RING_PALETTES.sourceSamples,
      },
      {
        id: "cancer-samples",
        title: "Sample categories",
        total: totalSamples,
        entries: sampleRingEntries,
        palette: RING_PALETTES.cancerSamples,
      },
      {
        id: "annotated",
        title: "Annotated",
        total: totalAnnotated,
        entries: annotatedRingEntries,
        palette: RING_PALETTES.annotated,
      },
      {
        id: "mutations",
        title: "Mutations",
        total: totalMutations,
        entries: mutationRingEntries,
        palette: RING_PALETTES.mutations,
      },
    ],
    [annotatedRingEntries, mutationRingEntries, sampleRingEntries, sourceRingEntries, totalAnnotated, totalMutations, totalSamples, totalSourceSamples],
  );
  const heroStatistics = [
    { value: ">10,000", label: "Samples" },
    { value: ">51M", label: "Variants" },
    { value: "18", label: "Cancer types" },
    { value: "EGA / TCGA / GEO", label: "Public sources" },
  ];

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
                ctDNA Database is a comprehensive pan-cancer resource for exploring circulating tumor DNA variants across diverse cancer types. By integrating in-house sequencing data with publicly available datasets from EGA, TCGA, and GEO, the database currently curates more than 10,000 samples, over 51 million variants, and 18 cancer types. It provides standardized variant annotation, clinical information, and interactive analysis modules, enabling users to investigate mutation landscapes, variant allele frequency patterns, genome distributions, mutation types, cancer-specific oncoplots, Ti/Tv profiles, and survival associations. ctDNA Database aims to support liquid biopsy biomarker discovery, tumor evolution research, treatment resistance analysis, and precision oncology studies.
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

              <div className="gdc-quick-stat-grid" aria-label="ctDNA Database statistics">
                {heroStatistics.map((item) => (
                  <div className="gdc-quick-stat" key={item.label}>
                    <strong>{item.value}</strong>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="gdc-col-middle">
            <div className="body-map">
              <img src={humanBodyImg} alt="Human body diagram with cancer sites" className="gdc-body-img" loading="eager" decoding="async" />

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
                  palette={card.palette}
                  onSliceClick={goToOverviewSlice}
                />
              ))}
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

      <section className="gdc-pipeline-section">
        <div className="gdc-pipeline-inner">
          <div className="gdc-card-head">
            <p className="section-eyebrow">Pipeline</p>
          </div>
          <div className="gdc-pipeline-frame">
            <img src={indexMutectImg} alt="ctDNAdb mutation analysis workflow" loading="lazy" decoding="async" />
          </div>
        </div>
      </section>
    </>
  );
}
