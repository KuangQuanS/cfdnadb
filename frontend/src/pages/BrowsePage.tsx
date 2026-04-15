import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  getOncoplottData,
  getStatisticsPlots,
  getStatisticsSources,
  toApiUrl,
} from "../api/client";
import { PdfPagePreview } from "../components/PdfPagePreview";
import { SectionHeader } from "../components/SectionHeader";
import { WaterfallChart } from "../components/WaterfallChart";
import { CANCER_OPTIONS, DEFAULT_CANCER } from "../constants/cfdna";
import type { CancerAsset, StatisticsSource } from "../types/api";

const SOURCE_LABELS: Record<string, string> = {
  private: "cfDNA Liquid Biopsy",
  public: "Public",
  tcga: "TCGA Solid Tumor",
  Overview: "Overview",
};

function normalizeCancerLabel(value: string) {
  if (value === "HeadAndNeck") return "Head & Neck";
  return value;
}

function getPlotDescription(asset: CancerAsset) {
  const kind = getPlotKind(asset);
  if (kind === "oncoplot") {
    return "Oncoplot summarizes recurrent mutated genes and their alteration patterns across samples in the selected cohort.";
  }
  if (kind === "titv") {
    return "Ti/Tv plot shows base-substitution composition and transition/transversion balance for the selected cohort.";
  }
  if (kind === "spectrum") {
    return "Spectrum plot breaks mutations into trinucleotide contexts so you can inspect substitution signatures within the cohort.";
  }
  if (kind === "summary") {
    return "Summary plot combines mutation-class burden, variant-type composition, and top altered genes into one cohort-level overview.";
  }
  return "Summary PDF generated from maftools for the selected cohort and source.";
}

function getPlotKind(asset: CancerAsset) {
  const key = `${asset.title} ${asset.fileName}`.toLowerCase();
  if (key.includes("oncplot") || key.includes("oncoplot") || key.includes("waterfall")) return "oncoplot";
  if (key.includes("summary")) return "summary";
  if (key.includes("spectrum")) return "spectrum";
  if (key.includes("titv") || key.includes("ti/tv") || key.includes("ti-tv")) return "titv";
  return "default";
}

function rankPlot(asset: CancerAsset) {
  const kind = getPlotKind(asset);
  if (kind === "oncoplot") return 0;
  if (kind === "summary") return 1;
  if (kind === "spectrum") return 2;
  if (kind === "titv") return 3;
  return 10;
}

function BrowsePlotCard({ asset, className = "" }: { asset: CancerAsset; className?: string }) {
  const plotKind = getPlotKind(asset);
  return (
    <article className={`stat-pdf-card stat-pdf-card--${plotKind}${className ? ` ${className}` : ""}`}>
      <div className="statistics-panel-header">
        <h3 className="stat-pdf-title">{asset.title}</h3>
        <p className="statistics-panel-note">{getPlotDescription(asset)}</p>
      </div>
      <div className="statistics-pdf-shell">
        <InlinePdfPage
          url={toApiUrl(asset.assetUrl)}
          title={asset.title}
          loadingLabel="Loading plot preview..."
          showCaption={false}
          className="statistics-inline-pdf--stat"
        />
      </div>
    </article>
  );
}

export function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const cancer = searchParams.get("cancer") ?? DEFAULT_CANCER;
  const source = searchParams.get("source") ?? "";

  const sourcesQ = useQuery({
    queryKey: ["browse-sources", cancer],
    queryFn: () => getStatisticsSources(cancer),
  });

  const sources: StatisticsSource[] = useMemo(
    () => (sourcesQ.data ?? []).filter((item) => item.source !== "public"),
    [sourcesQ.data]
  );
  const activeSource = source && sources.some((item) => item.source === source) ? source : sources[0]?.source ?? "";
  const selectedLabel = SOURCE_LABELS[activeSource] ?? activeSource;

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams);
      params.set(key, value);
      if (key === "cancer") {
        params.delete("source");
      }
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const plotsQ = useQuery({
    queryKey: ["browse-plots", cancer, activeSource],
    queryFn: () => getStatisticsPlots(cancer, activeSource),
    enabled: !!activeSource,
  });

  const oncoplottQ = useQuery({
    queryKey: ["browse-oncoplot", activeSource, cancer],
    queryFn: () => getOncoplottData(activeSource, [cancer], 40),
    enabled: !!activeSource && !!cancer,
    staleTime: 5 * 60_000,
  });

  const plotAssets = useMemo(
    () => [...(plotsQ.data ?? [])].sort((left, right) => rankPlot(left) - rankPlot(right) || left.title.localeCompare(right.title)),
    [plotsQ.data]
  );
  const summaryPlotAssets = useMemo(
    () => plotAssets.filter((asset) => getPlotKind(asset) !== "oncoplot"),
    [plotAssets]
  );
  const featuredSummaryPlot = useMemo(
    () => summaryPlotAssets.find((asset) => getPlotKind(asset) === "spectrum") ?? summaryPlotAssets[0] ?? null,
    [summaryPlotAssets]
  );
  const secondarySummaryPlots = useMemo(
    () => summaryPlotAssets.filter((asset) => asset.fileName !== featuredSummaryPlot?.fileName),
    [summaryPlotAssets, featuredSummaryPlot]
  );

  const sourceSummary = useMemo(() => {
    if (!activeSource) return "Choose a cohort and source to inspect summary PDFs and the interactive oncoplot.";
    return "Browse is cohort-centric: inspect global mutation patterns, summary PDFs, and sample-by-gene alteration structure for the selected cohort.";
  }, [activeSource]);

  return (
    <div className="page-stack statistics-page">
      <SectionHeader
        eyebrow="Browse"
        title="Cohort browser"
        description="Browse each cohort through oncoplots and maftools summary plots. This page is now cohort-centric rather than sample-centric."
      />

      <section className="detail-card statistics-toolbar-card">
        <div className="statistics-toolbar-top">
          <label className="statistics-toolbar-field">
            <span>Cohort</span>
            <select value={cancer} onChange={(event) => setParam("cancer", event.target.value)}>
              {CANCER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {normalizeCancerLabel(option)}
                </option>
              ))}
            </select>
          </label>

          <div className="statistics-toolbar-group">
            <span className="statistics-toolbar-label">Data Source</span>
            <div className="statistics-source-tabs">
              {sources.map((item) => (
                <button
                  key={item.source}
                  className={`statistics-source-tab${activeSource === item.source ? " active" : ""}`}
                  onClick={() => setParam("source", item.source)}
                  type="button"
                >
                  {SOURCE_LABELS[item.source] ?? item.source}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="statistics-toolbar-meta">
          <strong>
            {normalizeCancerLabel(cancer)} {activeSource ? `| ${selectedLabel}` : ""}
          </strong>
          <p>{sourceSummary}</p>
        </div>
      </section>

      {sourcesQ.isLoading ? <p className="panel-note">Discovering data sources...</p> : null}
      {sources.length === 0 && !sourcesQ.isLoading ? (
        <section className="detail-card empty-card">
          <h3>No data sources found</h3>
          <p>{normalizeCancerLabel(cancer)} does not have any discoverable plot directories.</p>
        </section>
      ) : null}

      {activeSource ? (
        <article className="stat-pdf-card stat-pdf-card--oncoplot statistics-oncoplot-card">
          <div className="statistics-panel-header">
            <h3 className="stat-pdf-title">Oncoplot</h3>
            <p className="statistics-panel-note">
              Top 40 most frequently mutated genes across all samples in {normalizeCancerLabel(cancer)} / {selectedLabel}. Each column is a sample, each row is a gene, and cells are colored by the most severe mutation class observed.
            </p>
          </div>
          {oncoplottQ.isLoading ? <p className="panel-note">Loading oncoplot data...</p> : null}
          {oncoplottQ.isError ? <p className="panel-note" style={{ color: "#c0392b" }}>Failed to load oncoplot data.</p> : null}
          {oncoplottQ.data && oncoplottQ.data.genes.length > 0 ? (
            <div className="statistics-pdf-shell statistics-pdf-shell--oncoplot">
              <WaterfallChart data={oncoplottQ.data} title={normalizeCancerLabel(cancer)} />
            </div>
          ) : oncoplottQ.data && !oncoplottQ.isLoading ? (
            <p className="panel-note">No mutation data available for this cohort / source.</p>
          ) : null}
        </article>
      ) : null}

      {activeSource ? (
        <section className="statistics-section-block">
          <div className="statistics-section-heading">
            <p className="section-eyebrow">
              {normalizeCancerLabel(cancer)} | {selectedLabel}
            </p>
            <h2>Summary Plots</h2>
            <p className="statistics-section-copy">
              These maftools summary views describe mutation spectrum, substitution bias, and overall cohort composition.
            </p>
          </div>

          {plotsQ.isLoading ? <p className="panel-note">Loading plots...</p> : null}
          {summaryPlotAssets.length > 0 ? (
            <div className="statistics-pdf-layout">
              {featuredSummaryPlot ? (
                <div className="statistics-pdf-featured-row">
                  <BrowsePlotCard asset={featuredSummaryPlot} className="stat-pdf-card--featured" />
                </div>
              ) : null}
              {secondarySummaryPlots.length > 0 ? (
                <div className="statistics-pdf-grid">
                  {secondarySummaryPlots.map((asset) => (
                    <BrowsePlotCard key={asset.fileName} asset={asset} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : plotsQ.data ? (
            <section className="detail-card empty-card">
              <h3>No plots available</h3>
              <p>
                No PDF files found for {normalizeCancerLabel(cancer)} / {selectedLabel}.
              </p>
            </section>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function InlinePdfPage({
  url,
  title,
  loadingLabel = "Loading PDF preview...",
  showCaption = true,
  className = "",
}: {
  url: string;
  title: string;
  loadingLabel?: string;
  showCaption?: boolean;
  className?: string;
}) {
  return (
    <div className={`statistics-inline-pdf${className ? ` ${className}` : ""}`}>
      <PdfPagePreview
        file={url}
        autoWidth
        minWidth={320}
        padding={32}
        pageClassName="statistics-inline-pdf-page"
        loadingLabel={loadingLabel}
      />
      {showCaption ? <p className="statistics-inline-pdf-caption">{title}</p> : null}
    </div>
  );
}
