import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  getOncoplottData,
  getStatisticsPlots,
  toApiUrl,
} from "../api/client";
import { PdfPagePreview } from "../components/PdfPagePreview";
import { SectionHeader } from "../components/SectionHeader";
import { WaterfallChart } from "../components/WaterfallChart";
import { CANCER_OPTIONS, DEFAULT_CANCER } from "../constants/cfdna";
import type { CancerAsset } from "../types/api";

const BROWSE_SOURCES = [
  { source: "cfDNA", label: "cfDNA" },
  { source: "geo", label: "GEO" },
  { source: "tcga", label: "TCGA" },
] as const;

const SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  BROWSE_SOURCES.map((item) => [item.source, item.label])
);

function toBrowsePlotSource(source: string) {
  if (source === "cfDNA") return "private";
  if (source === "tcga") return "tcga";
  return "geo";
}

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

  const activeSource = source && BROWSE_SOURCES.some((item) => item.source === source) ? source : BROWSE_SOURCES[0].source;
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

  const plotSource = toBrowsePlotSource(activeSource);

  const plotsQ = useQuery({
    queryKey: ["browse-plots", cancer, plotSource],
    queryFn: () => getStatisticsPlots(cancer, plotSource),
    enabled: !!plotSource,
  });

  const oncoplottQ = useQuery({
    queryKey: ["browse-oncoplot", plotSource, cancer],
    queryFn: () => getOncoplottData(plotSource, [cancer], 40),
    enabled: !!plotSource && !!cancer,
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
  const orderedSummaryPlots = useMemo(
    () => {
      const byKind = new Map(summaryPlotAssets.map((asset) => [getPlotKind(asset), asset]));
      return ["summary", "spectrum", "titv"]
        .map((kind) => byKind.get(kind))
        .filter((asset): asset is CancerAsset => Boolean(asset));
    },
    [summaryPlotAssets]
  );

  const sourceSummary = useMemo(() => {
    if (activeSource === "cfDNA") {
      return "cfDNA uses the Private cfDNA statistics plots and pan-cancer oncoplot for the selected cancer type.";
    }
    if (activeSource === "geo") {
      return "GEO uses GEO statistics plots; the interactive oncoplot uses the cfDNA pan-cancer mutation matrix.";
    }
    if (activeSource === "tcga") {
      return "TCGA uses its independent oncoplot and cohort summary plots for the selected cancer type.";
    }
    return "";
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

          <label className="statistics-toolbar-field statistics-toolbar-field--compact">
            <span>Data Source</span>
            <select value={activeSource} onChange={(event) => setParam("source", event.target.value)}>
              {BROWSE_SOURCES.map((item) => (
                <option key={item.source} value={item.source}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="statistics-toolbar-meta">
          <strong>
            {normalizeCancerLabel(cancer)} {activeSource ? `| ${selectedLabel}` : ""}
          </strong>
          <p>{sourceSummary}</p>
        </div>
      </section>


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
          {orderedSummaryPlots.length > 0 ? (
            <div className="statistics-pdf-layout statistics-pdf-layout--browse">
              <div className="statistics-pdf-stack">
                {orderedSummaryPlots.map((asset) => (
                  <BrowsePlotCard
                    key={asset.fileName}
                    asset={asset}
                    className={`browse-pdf-card browse-pdf-card--${getPlotKind(asset)}`}
                  />
                ))}
              </div>
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
