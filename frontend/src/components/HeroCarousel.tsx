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

const CORE_COHORT_COLORS: Record<string, string> = {
  Breast: "#eb6a7f",
  Colorectal: "#5a49b7",
  Liver: "#28a07f",
  Lung: "#2f79b7",
  Pancreatic: "#f29a4a",
};

const COHORT_COLOR_FALLBACK = [
  "#eb6a7f",
  "#2f79b7",
  "#28a07f",
  "#5a49b7",
  "#f29a4a",
  "#7b61c9",
  "#1f9d8a",
  "#d06a8a",
  "#4f8bc9",
  "#84b547",
  "#cf7f44",
  "#7d8da6",
  "#a05195",
  "#2d7f5e",
  "#c1556b",
];

const COHORT_PRIORITY = ["Breast", "Colorectal", "Lung", "Liver", "Pancreatic"] as const;

const ALL_CALLOUTS = [
  /* ── left side (top → bottom) ── */
  { id: "HeadAndNeck", label: "Head & Neck", side: "left", topPct: 13, anchorPct: 48, browseKey: "HeadAndNeck", alwaysShow: false },
  { id: "Lung", label: "Lung", side: "left", topPct: 28, anchorPct: 42, browseKey: "Lung", alwaysShow: true },
  { id: "Liver", label: "Liver", side: "left", topPct: 38, anchorPct: 43, browseKey: "Liver", alwaysShow: true },
  { id: "Kidney", label: "Kidney", side: "left", topPct: 43, anchorPct: 41, browseKey: "Kidney", alwaysShow: false },
  { id: "Endometrial", label: "Endometrial", side: "left", topPct: 55, anchorPct: 48, browseKey: "Endometrial", alwaysShow: false },
  { id: "Bladder", label: "Bladder", side: "left", topPct: 62, anchorPct: 50, browseKey: "Bladder", alwaysShow: false },
  /* ── right side (top → bottom) ── */
  { id: "Breast", label: "Breast", side: "right", topPct: 31, anchorPct: 58, browseKey: "Breast", alwaysShow: true },
  { id: "Gastric", label: "Gastric", side: "right", topPct: 39, anchorPct: 54, browseKey: "Gastric", alwaysShow: false },
  { id: "Pancreatic", label: "Pancreas", side: "right", topPct: 43, anchorPct: 52, browseKey: "Pancreatic", alwaysShow: true },
  { id: "Colorectal", label: "Colorectal", side: "right", topPct: 51, anchorPct: 55, browseKey: "Colorectal", alwaysShow: true },
  { id: "Ovarian", label: "Ovarian", side: "right", topPct: 56, anchorPct: 53, browseKey: "Ovarian", alwaysShow: false },
] as const;

type HeroRingEntry = {
  id: string;
  label: string;
  color: string;
  value: number;
  browseKey: string;
};

function buildSunburstEntries(entries: HeroRingEntry[], limit = 7) {
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, limit);
  const tail = sorted.slice(limit);
  const otherValue = tail.reduce((sum, entry) => sum + entry.value, 0);

  const children = head.map((entry) => ({
    name: entry.label,
    value: entry.value,
    browseKey: entry.browseKey,
    itemStyle: { color: entry.color },
  }));

  if (otherValue > 0) {
    children.push({
      name: "Other",
      value: otherValue,
      browseKey: "",
      itemStyle: { color: "#d9e2ee" },
    });
  }

  return children;
}

function buildHeroSunburstOption(title: string, total: number, entries: HeroRingEntry[]): EChartsOption {
  const children = buildSunburstEntries(entries);

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
        return `${params.name}<br/>${formatNumber(value)} ${title.toLowerCase()} (${pct}%)`;
      },
    },
    series: [
      {
        type: "sunburst",
        radius: [0, "84%"],
        center: ["50%", "54%"],
        sort: undefined,
        nodeClick: false,
        data: [
          {
            name: title,
            value: total,
            itemStyle: { color: "#1d5f38" },
            label: {
              rotate: 0,
              color: "#ffffff",
              fontWeight: 800,
              fontSize: 12,
              formatter: `${title}\n${formatNumber(total)}`,
            },
            children,
          },
        ],
        levels: [
          {},
          {
            r0: "0%",
            r: "44%",
            itemStyle: {
              borderColor: "#ffffff",
              borderWidth: 2,
            },
            label: {
              rotate: 0,
            },
          },
          {
            r0: "46%",
            r: "84%",
            itemStyle: {
              borderColor: "#ffffff",
              borderWidth: 2,
            },
            label: {
              rotate: "radial",
              color: "#ffffff",
              minAngle: 9,
              fontSize: 10,
              overflow: "truncate",
              formatter: (params: { name?: string; value?: number }) => {
                const value = params.value ?? 0;
                if (!params.name || params.name === "Other") {
                  return value > 0 ? `Other\n${formatNumber(value)}` : "";
                }
                return value >= Math.max(40, total * 0.035)
                  ? `${params.name}\n${formatNumber(value)}`
                  : "";
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
  onSliceClick,
}: {
  title: string;
  total: number;
  entries: HeroRingEntry[];
  caption: string;
  onSliceClick: (browseKey: string) => void;
}) {
  const option = useMemo(() => buildHeroSunburstOption(title, total, entries), [entries, title, total]);

  return (
    <article className="gdc-overview-chart" aria-label={title}>
      <h3 className="gdc-overview-chart-title">
        {formatNumber(total)} {title}
      </h3>
      <div className="gdc-overview-chart-shell">
        <ReactECharts
          option={option}
          style={{ height: 240, width: "100%" }}
          opts={{ renderer: "svg" }}
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

      return sorted.map((cohort, index) => ({
        id: cohort.cancer,
        label: cohort.cancer,
        color: CORE_COHORT_COLORS[cohort.cancer] ?? COHORT_COLOR_FALLBACK[index % COHORT_COLOR_FALLBACK.length],
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
    () => ringEntries.map(({ id, label, color, sampleCount }) => ({ id, label, color, value: sampleCount, browseKey: label })),
    [ringEntries],
  );
  const fileRingEntries = useMemo(
    () => ringEntries.map(({ id, label, color, fileCount }) => ({ id, label, color, value: fileCount, browseKey: label })),
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
    () => ringEntries.map(({ id, label, color, annotatedCount }) => ({ id, label, color, value: annotatedCount, browseKey: label })),
    [ringEntries],
  );
  const mutationRingEntries = useMemo(
    () => ringEntries.map(({ id, label, color, mutationCount }) => ({ id, label, color, value: mutationCount, browseKey: label })),
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
      },
      {
        id: "files",
        title: "Data files",
        total: totalFiles,
        entries: fileRingEntries,
        caption: "Imported mutation and cohort-level source files.",
      },
      {
        id: "annotated",
        title: "Annotated",
        total: totalAnnotated,
        entries: annotatedRingEntries,
        caption: "Variants with functional annotations per cohort.",
      },
      {
        id: "mutations",
        title: "Mutations",
        total: totalMutations,
        entries: mutationRingEntries,
        caption: "Somatic mutation records per cohort.",
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
          <p className="gdc-eyebrow">Plasma somatic mutation database</p>
          <h1 className="gdc-title">
            Welcome to <span>cfDNAdb</span>
          </h1>
          <p className="gdc-hero-tagline">A cell-free DNA mutation atlas across the indexed cancer cohorts</p>
          <p className="gdc-subtitle">
            cfDNAdb centralizes cohort-level somatic mutation profiles, sample browse, gene-oriented querying,
            and downloadable analysis resources across the full imported cancer collection, with anatomical browse highlights for breast, colorectal, liver, lung, and pancreatic cohorts.
          </p>

          <div className="gdc-search-dock gdc-search-dock--inline">
            <div className="gdc-search-dock-head">
              <h2>Gene search</h2>
              <p>Jump straight into the cfDNA mutation workbench with a gene symbol.</p>
            </div>

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
