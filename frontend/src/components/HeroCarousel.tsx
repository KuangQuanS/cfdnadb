import { type CSSProperties, type FormEvent, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { Link, useNavigate } from "react-router-dom";
import { getCancerSummary } from "../api/client";
import { DEFAULT_GENE } from "../constants/cfdna";
import type { CancerSummary } from "../types/api";
import { formatNumber } from "../utils/format";
import humanBodyImg from "../assets/human_body_new.png";
import siteLogoPng from "../assets/cfDNAlogo.png";
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

const ALL_CALLOUTS = [
  /* ── left side (top → bottom) ── */
  { id: "HeadAndNeck", label: "Head & Neck", side: "left", topPct: 17, anchorPct: 49, browseKey: "HeadAndNeck", alwaysShow: false },
  { id: "Lung", label: "Lung", side: "left", topPct: 28, anchorPct: 42, browseKey: "Lung", alwaysShow: true },
  { id: "Liver", label: "Liver", side: "left", topPct: 38, anchorPct: 43, browseKey: "Liver", alwaysShow: true },
  { id: "Kidney", label: "Kidney", side: "left", topPct: 43, anchorPct: 43, browseKey: "Kidney", alwaysShow: false },
  { id: "Endometrial", label: "Endometrial", side: "left", topPct: 52, anchorPct: 48, browseKey: "Endometrial", alwaysShow: false },
  { id: "Bladder", label: "Bladder", side: "left", topPct: 58, anchorPct: 50, browseKey: "Bladder", alwaysShow: false },
  /* ── right side (top → bottom) ── */
  { id: "Breast", label: "Breast", side: "right", topPct: 31, anchorPct: 60, browseKey: "Breast", alwaysShow: true },
  { id: "Gastric", label: "Gastric", side: "right", topPct: 39, anchorPct: 54, browseKey: "Gastric", alwaysShow: false },
  { id: "Pancreatic", label: "Pancreas", side: "right", topPct: 43, anchorPct: 52, browseKey: "Pancreatic", alwaysShow: true },
  { id: "Colorectal", label: "Colorectal", side: "right", topPct: 51, anchorPct: 55, browseKey: "Colorectal", alwaysShow: true },
  { id: "Ovarian", label: "Ovarian", side: "right", topPct: 56, anchorPct: 53, browseKey: "Ovarian", alwaysShow: false },
] as const;

type HeroRingEntry = {
  id: string;
  label: string;
  value: number;
  browseKey: string;
};

function formatThousands(value: number) {
  return `${(value / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k`;
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
  const formatValue = (value: number) => (isMutations ? formatThousands(value) : formatNumber(value));

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
        type: "sunburst",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        radius: [0, "96%"],
        center: ["50%", "50%"],
        sort: undefined,
        nodeClick: false,
        data: [
          {
            name: title,
            value: total,
            itemStyle: { color: "#1d5f38" },
            label: {
              rotate: 0,
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
            children,
          },
        ],
        levels: [
          {},
          {
            r0: "0%",
            r: "46%",
            itemStyle: {
              borderColor: "#ffffff",
              borderWidth: 2,
            },
            label: {
              rotate: 0,
            },
          },
          {
            r0: "48%",
            r: "92%",
            itemStyle: {
              borderColor: "#ffffff",
              borderWidth: 2,
            },
            label: {
              rotate: "radial",
              color: "#ffffff",
              minAngle: 12,
              fontSize: 10,
              lineHeight: 11,
              overflow: "break",
              formatter: (params: { name?: string; value?: number }) => {
                const value = params.value ?? 0;
                if (!params.name || params.name === "Other") {
                  return value > 0 ? `Other\n${formatValue(value)}` : "";
                }
                return value >= Math.max(40, total * 0.04) ? formatRingLabel(params.name, formatValue(value)) : "";
              },
            },
          },
        ],
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
  const option = useMemo(
    () => buildHeroSunburstOption(title, total, entries, palette),
    [entries, palette, title, total],
  );

  return (
    <article className="gdc-overview-chart" aria-label={title}>
      <h3 className="gdc-overview-chart-title">
        {formatNumber(total)} {title}
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
      <p className="gdc-overview-chart-caption">{caption}</p>
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
  const visibleCallouts = useMemo(
    () => ALL_CALLOUTS.filter((entry) => {
      if (entry.alwaysShow) return true;
      return (countMap[entry.id] ?? 0) > 0;
    }),
    [countMap],
  );
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
          <h1 className="gdc-title">
            Welcome to <img src={siteLogoPng} alt="cfDNAdb" className="gdc-title-logo" />
          </h1>
          <div className="gdc-subtitle">
            <p>
              cfDNAdb represents a comprehensive plasma cell-free DNA somatic mutation resource encompassing {formatNumber(INTRO_TOTAL_SAMPLES)} curated samples across major cancer cohorts, including breast, colorectal, gastric, liver, lung, pancreatic, head and neck, kidney, and ovarian malignancies.
            </p>
            <p>
              The database integrates cohort-level sample metadata, annotated variant profiles, and downloadable analysis resources, currently comprising {formatNumber(INTRO_TOTAL_FILES)} data files and {formatNumber(INTRO_TOTAL_MUTATIONS)} imported mutation records.
            </p>
            <p>
              The platform provides anatomical browsing, sample exploration, gene-oriented querying, cohort statistics, visualization modules, and download workflows to support cross-cohort comparison and biomarker-focused liquid biopsy research.
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
                <Link to="/gene-search" className="gdc-search-link">Advanced search</Link>
              </div>
            </form>
          </div>
        </div>

        <div className="gdc-col-middle">
          <div className="body-map">
            <img src={humanBodyImg} alt="Human body diagram with cancer sites" className="gdc-body-img" />

            {visibleCallouts.map((cfg) => (
              <button
                key={cfg.id}
                type="button"
                className={`body-callout body-callout--${cfg.side}`}
                style={{ top: `${cfg.topPct}%`, "--anchor-x": `${cfg.anchorPct}%` } as CSSProperties}
                onClick={() => goToBrowse(cfg.browseKey)}
                aria-label={`Browse ${cfg.label} cohort`}
              >
                {cfg.side === "left" ? (
                  <>
                    <div className="callout-label">
                      <strong>{cfg.label}</strong>
                      <span>{formatNumber(countMap[cfg.id] ?? 0)}</span>
                    </div>
                    <div className="callout-stem" />
                    <div className="callout-dot" />
                  </>
                ) : (
                  <>
                    <div className="callout-dot" />
                    <div className="callout-stem" />
                    <div className="callout-label">
                      <strong>{cfg.label}</strong>
                      <span>{formatNumber(countMap[cfg.id] ?? 0)}</span>
                    </div>
                  </>
                )}
              </button>
            ))}
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
