import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import {
  getStatisticsGenes,
  getStatisticsGenePlotUrl,
  getStatisticsPlots,
  getStatisticsSources,
  toApiUrl,
} from "../api/client";
import { SectionHeader } from "../components/SectionHeader";
import { CANCER_OPTIONS, DEFAULT_CANCER } from "../constants/cfdna";
import type { CancerAsset, StatisticsSource } from "../types/api";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

const DEFAULT_STAT_GENE = "TP53";

const SOURCE_LABELS: Record<string, string> = {
  Private_cfDNA: "Private cfDNA",
  GEO: "GEO",
  TCGA: "TCGA",
  Overview: "Overview",
};

function normalizeCancerLabel(value: string) {
  if (value === "Colonrector") return "Colorectal";
  if (value === "Pdac") return "Pancreas";
  return value;
}

function getPlotDescription(asset: CancerAsset) {
  const key = `${asset.title} ${asset.fileName}`.toLowerCase();
  if (key.includes("oncoplot")) {
    return "Oncoplot summarizes recurrent mutated genes and their alteration patterns across samples in the selected cohort.";
  }
  if (key.includes("titv")) {
    return "Ti/Tv plot shows base-substitution composition and transition/transversion balance, helping assess mutation spectrum differences.";
  }
  if (key.includes("spectrum")) {
    return "Spectrum plot breaks mutations into trinucleotide contexts so you can inspect substitution signatures within the cohort.";
  }
  if (key.includes("summary")) {
    return "Summary plot combines mutation-class burden, variant-type composition, and top altered genes into one cohort-level overview.";
  }
  return "Summary PDF generated from maftools for the selected cohort and source.";
}

function rankPlot(asset: CancerAsset) {
  const key = `${asset.title} ${asset.fileName}`.toLowerCase();
  if (key.includes("spectrum")) return 0;
  if (key.includes("titv")) return 1;
  if (key.includes("oncoplot")) return 2;
  if (key.includes("summary")) return 3;
  return 10;
}

export function StatisticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const cancer = searchParams.get("cancer") ?? DEFAULT_CANCER;
  const source = searchParams.get("source") ?? "";

  const [geneQuery, setGeneQuery] = useState("");
  const [selectedGene, setSelectedGene] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);

  const sourcesQ = useQuery({
    queryKey: ["stat-sources", cancer],
    queryFn: () => getStatisticsSources(cancer),
  });

  const sources: StatisticsSource[] = sourcesQ.data ?? [];
  const activeSource = source && sources.some((item) => item.source === source) ? source : sources[0]?.source ?? "";
  const currentSourceMeta = sources.find((item) => item.source === activeSource);
  const hasGenePlots = currentSourceMeta?.hasGenePlots ?? false;
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
    queryKey: ["stat-plots", cancer, activeSource],
    queryFn: () => getStatisticsPlots(cancer, activeSource),
    enabled: !!activeSource,
  });

  const genesQ = useQuery({
    queryKey: ["stat-genes", cancer, activeSource, geneQuery],
    queryFn: () => getStatisticsGenes(cancer, activeSource, geneQuery),
    enabled: hasGenePlots && geneQuery.length >= 1,
  });

  const suggestions = genesQ.data ?? [];

  useEffect(() => {
    setGeneQuery("");
    setSelectedGene(null);
    setShowSuggestions(false);
    setHighlightIdx(-1);
  }, [cancer, activeSource]);

  useEffect(() => {
    if (hasGenePlots && !selectedGene) {
      setGeneQuery(DEFAULT_STAT_GENE);
      setSelectedGene(DEFAULT_STAT_GENE);
    }
  }, [hasGenePlots, selectedGene]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectGene = (gene: string) => {
    const normalized = gene.trim().toUpperCase();
    if (!normalized) return;
    setSelectedGene(normalized);
    setGeneQuery(normalized);
    setShowSuggestions(false);
    setHighlightIdx(-1);
  };

  const submitGene = () => {
    if (!geneQuery.trim()) return;
    selectGene(geneQuery);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightIdx((idx) => Math.min(idx + 1, suggestions.length - 1));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightIdx((idx) => Math.max(idx - 1, 0));
        return;
      }

      if (event.key === "Enter" && highlightIdx >= 0) {
        event.preventDefault();
        selectGene(suggestions[highlightIdx]);
        return;
      }
    }

    if (event.key === "Enter") {
      event.preventDefault();
      submitGene();
      return;
    }

    if (event.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const plotAssets = useMemo(
    () => [...(plotsQ.data ?? [])].sort((left, right) => rankPlot(left) - rankPlot(right) || left.title.localeCompare(right.title)),
    [plotsQ.data]
  );

  const sourceSummary = useMemo(() => {
    if (!activeSource) return "Choose a cohort and source to inspect summary PDFs and per-gene mutation plots.";
    if (hasGenePlots) return "This source includes both cohort-level summary PDFs and gene-level lollipop plots.";
    return "This source currently provides cohort-level summary PDFs only.";
  }, [activeSource, hasGenePlots]);

  const genePlotUrl = selectedGene ? getStatisticsGenePlotUrl(cancer, activeSource, selectedGene) : null;

  return (
    <div className="page-stack statistics-page">
      <SectionHeader
        eyebrow="Statistics"
        title="Cohort statistical plots and gene analysis"
        description="Explore cohort-level maftools summaries first, then move into a selected gene to inspect its protein-domain mutation pattern."
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
                  {item.hasGenePlots ? <small>gene plots</small> : null}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="statistics-toolbar-meta">
          <strong>
            {normalizeCancerLabel(cancer)} {activeSource ? `· ${selectedLabel}` : ""}
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
        <section className="statistics-section-block">
          <div className="statistics-section-heading">
            <p className="section-eyebrow">
              {normalizeCancerLabel(cancer)} · {selectedLabel}
            </p>
            <h2>Summary Plots</h2>
            <p className="statistics-section-copy">
              These four maftools summary views describe mutation spectrum, substitution bias, recurrently altered genes, and overall cohort composition.
            </p>
          </div>

          {plotsQ.isLoading ? <p className="panel-note">Loading plots...</p> : null}
          {plotAssets.length > 0 ? (
            <div className="statistics-pdf-grid">
              {plotAssets.map((asset) => (
                <article key={asset.fileName} className="stat-pdf-card">
                  <div className="statistics-panel-header">
                    <h3 className="stat-pdf-title">{asset.title}</h3>
                    <p className="statistics-panel-note">{getPlotDescription(asset)}</p>
                  </div>
                  <div className="statistics-pdf-shell">
                    <embed
                      className="stat-pdf-frame"
                      src={toApiUrl(asset.assetUrl)}
                      type="application/pdf"
                      title={asset.title}
                    />
                  </div>
                </article>
              ))}
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

      {hasGenePlots ? (
        <section className="detail-card statistics-gene-panel">
          <div className="statistics-panel-header">
            <div>
              <p className="section-eyebrow">
                {normalizeCancerLabel(cancer)} · {selectedLabel}
              </p>
              <h2>Gene Lollipop Plot</h2>
              <p className="statistics-panel-copy">
                Lollipop plots place observed coding mutations onto the protein model so you can quickly inspect hotspot clustering and affected domains.
              </p>
            </div>
          </div>

          <div className="statistics-gene-toolbar">
            <div className="gene-search-box statistics-gene-search-box">
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a gene name (e.g. TP53, BRCA1)..."
                value={geneQuery}
                onChange={(event) => {
                  setGeneQuery(event.target.value.toUpperCase());
                  setSelectedGene(null);
                  setShowSuggestions(true);
                  setHighlightIdx(-1);
                }}
                onFocus={() => {
                  if (geneQuery.length >= 1) setShowSuggestions(true);
                }}
                onKeyDown={handleKeyDown}
              />
              {showSuggestions && suggestions.length > 0 ? (
                <ul className="gene-suggestions" ref={suggestionsRef}>
                  {suggestions.map((gene, idx) => (
                    <li
                      key={gene}
                      className={idx === highlightIdx ? "highlighted" : ""}
                      onMouseDown={() => selectGene(gene)}
                    >
                      {gene}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="statistics-gene-actions">
              <button className="button-primary statistics-gene-submit" type="button" onClick={submitGene}>
                Load Plot
              </button>
              {selectedGene ? <span className="statistics-selected-gene">Selected gene: {selectedGene}</span> : null}
            </div>
          </div>

          <div className="statistics-gene-explainer">
            <p>
              Default gene is <strong>{DEFAULT_STAT_GENE}</strong> so the lollipop module is immediately populated on first entry. Replace it with another symbol and click
              <strong> Load Plot</strong> to refresh the figure.
            </p>
          </div>

          {selectedGene && genePlotUrl ? (
            <div className="gene-plot-viewer statistics-gene-viewer">
              <div className="statistics-panel-header statistics-panel-header-soft">
                <h3>{selectedGene} mutation map</h3>
                <p className="statistics-panel-note">
                  Colored lollipops mark distinct mutation classes along the transcript-coded protein structure for the selected cohort.
                </p>
              </div>
              <InlinePdfPage url={genePlotUrl} title={`${selectedGene} lollipop plot`} />
            </div>
          ) : (
            <div className="statistics-gene-empty">
              <strong>No gene selected</strong>
              <p>Use the search box above to load a lollipop plot for the current cohort and source.</p>
            </div>
          )}
        </section>
      ) : activeSource ? (
        <section className="detail-card empty-card">
          <h3>Gene plots unavailable</h3>
          <p>{selectedLabel} currently exposes summary PDFs only.</p>
        </section>
      ) : null}
    </div>
  );
}

function InlinePdfPage({ url, title }: { url: string; title: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(960);

  useLayoutEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;

    const updateWidth = () => {
      setWidth(Math.max(320, Math.floor(element.clientWidth - 32)));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="statistics-inline-pdf" ref={wrapperRef}>
      <Document file={url} loading={<p className="panel-note">Loading gene plot...</p>} error={<p className="panel-note">Unable to load this PDF preview.</p>}>
        <Page pageNumber={1} width={width} renderTextLayer={false} renderAnnotationLayer={false} className="statistics-inline-pdf-page" />
      </Document>
      <p className="statistics-inline-pdf-caption">{title}</p>
    </div>
  );
}
