import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  getStatisticsSources,
  getStatisticsPlots,
  getStatisticsGenes,
  getStatisticsGenePlotUrl,
  toApiUrl
} from "../api/client";
import { SectionHeader } from "../components/SectionHeader";
import { CANCER_OPTIONS, DEFAULT_CANCER } from "../constants/cfdna";
import type { StatisticsSource } from "../types/api";

const SOURCE_LABELS: Record<string, string> = {
  Private_cfDNA: "Private cfDNA",
  GEO: "GEO",
  TCGA: "TCGA",
  Overview: "Overview"
};

export function StatisticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const cancer = searchParams.get("cancer") ?? DEFAULT_CANCER;
  const source = searchParams.get("source") ?? "";

  // Gene search state
  const [geneQuery, setGeneQuery] = useState("");
  const [selectedGene, setSelectedGene] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);

  // Data sources query
  const sourcesQ = useQuery({
    queryKey: ["stat-sources", cancer],
    queryFn: () => getStatisticsSources(cancer)
  });

  // Auto-select first source when sources load or cancer changes
  const sources: StatisticsSource[] = sourcesQ.data ?? [];
  const activeSource = source && sources.some((s) => s.source === source) ? source : sources[0]?.source ?? "";

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

  // Plots for current source
  const plotsQ = useQuery({
    queryKey: ["stat-plots", cancer, activeSource],
    queryFn: () => getStatisticsPlots(cancer, activeSource),
    enabled: !!activeSource
  });

  // Current source metadata
  const currentSourceMeta = sources.find((s) => s.source === activeSource);
  const hasGenePlots = currentSourceMeta?.hasGenePlots ?? false;

  // Gene autocomplete query
  const genesQ = useQuery({
    queryKey: ["stat-genes", cancer, activeSource, geneQuery],
    queryFn: () => getStatisticsGenes(cancer, activeSource, geneQuery),
    enabled: hasGenePlots && geneQuery.length >= 1
  });

  const suggestions = genesQ.data ?? [];

  // Reset gene search when cancer or source changes
  useEffect(() => {
    setGeneQuery("");
    setSelectedGene(null);
    setShowSuggestions(false);
  }, [cancer, activeSource]);

  // Keyboard navigation for suggestions
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && highlightIdx >= 0) {
      e.preventDefault();
      selectGene(suggestions[highlightIdx]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const selectGene = (gene: string) => {
    setSelectedGene(gene);
    setGeneQuery(gene);
    setShowSuggestions(false);
    setHighlightIdx(-1);
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node) &&
          suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const genePlotUrl = selectedGene ? getStatisticsGenePlotUrl(cancer, activeSource, selectedGene) : null;

  return (
    <div className="page-stack">
      <SectionHeader
        eyebrow="Statistics"
        title="Cohort statistical plots and gene analysis"
        description="maftools-generated statistical plots for each cancer cohort and data source, plus per-gene lollipop plots."
      />

      {/* Cancer selector */}
      <section className="filter-panel">
        <label htmlFor="cancer-sel" style={{ marginRight: 8, fontWeight: 500 }}>Cohort:</label>
        <select id="cancer-sel" value={cancer} onChange={(e) => setParam("cancer", e.target.value)}>
          {CANCER_OPTIONS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </section>

      {/* Data source tabs */}
      {sourcesQ.isLoading && <p className="panel-note">Discovering data sources...</p>}
      {sources.length > 0 && (
        <div className="source-tabs">
          {sources.map((s) => (
            <button
              key={s.source}
              className={`source-tab${activeSource === s.source ? " active" : ""}`}
              onClick={() => setParam("source", s.source)}
            >
              {SOURCE_LABELS[s.source] ?? s.source}
              {s.hasGenePlots && " *"}
            </button>
          ))}
        </div>
      )}
      {sources.length === 0 && !sourcesQ.isLoading && (
        <section className="detail-card empty-card">
          <h3>No data sources found</h3>
          <p>{cancer} does not have any discoverable plot directories.</p>
        </section>
      )}

      {/* PDF plot gallery — one per row, full width */}
      {activeSource && (
        <section className="page-stack compact-gap">
          <SectionHeader
            eyebrow={`${cancer} · ${SOURCE_LABELS[activeSource] ?? activeSource}`}
            title="Summary Plots"
          />
          {plotsQ.isLoading && <p className="panel-note">Loading plots...</p>}
          {plotsQ.data && plotsQ.data.length > 0 ? (
            <div className="stat-pdf-list">
              {plotsQ.data.map((asset) => (
                <article key={asset.fileName} className="stat-pdf-card">
                  <h3 className="stat-pdf-title">{asset.title}</h3>
                  <embed
                    className="stat-pdf-frame"
                    src={toApiUrl(asset.assetUrl)}
                    type="application/pdf"
                    title={asset.title}
                  />
                </article>
              ))}
            </div>
          ) : plotsQ.data && plotsQ.data.length === 0 ? (
            <section className="detail-card empty-card">
              <h3>No plots available</h3>
              <p>No PDF files found for {cancer} / {SOURCE_LABELS[activeSource] ?? activeSource}.</p>
            </section>
          ) : null}
        </section>
      )}

      {/* Gene lollipop plot section */}
      {hasGenePlots && (
        <section className="page-stack compact-gap">
          <SectionHeader
            eyebrow={`${cancer} · ${SOURCE_LABELS[activeSource] ?? activeSource}`}
            title="Gene Lollipop Plot"
            description="Search for a gene to view its lollipop mutation plot."
          />

          <div className="gene-search-box">
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a gene name (e.g. TP53, BRCA1)..."
              value={geneQuery}
              onChange={(e) => {
                setGeneQuery(e.target.value);
                setSelectedGene(null);
                setShowSuggestions(true);
                setHighlightIdx(-1);
              }}
              onFocus={() => {
                if (geneQuery.length >= 1) setShowSuggestions(true);
              }}
              onKeyDown={handleKeyDown}
            />
            {showSuggestions && suggestions.length > 0 && (
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
            )}
          </div>

          {genePlotUrl && selectedGene && (
            <div className="gene-plot-viewer">
              <h3>Lollipop plot: {selectedGene}</h3>
              <embed
                className="gene-plot-frame"
                src={genePlotUrl}
                type="application/pdf"
                title={`Lollipop plot for ${selectedGene}`}
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
