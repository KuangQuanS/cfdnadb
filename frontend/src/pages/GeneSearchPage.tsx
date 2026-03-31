import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { useSearchParams } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { getGeneVariants, getGeneSummary, getAllGenes } from "../api/client";
import { DataTable } from "../components/DataTable";
import { CANCER_OPTIONS, DEFAULT_CANCER, DEFAULT_GENE } from "../constants/cfdna";
import { COMMON_CANCER_GENES } from "../constants/genes";
import type { GeneVariant, GeneSummary, LabelCount } from "../types/api";
import { formatNumber } from "../utils/format";

const ACCENT = "#2C3A85";
const WARM = "#FC812F";
const CHART_COLORS = ["#2C3A85", "#FC812F", "#38A169", "#E53E3E", "#DD6B20", "#805AD5", "#3182CE", "#D69E2E", "#319795", "#B83280"];

const columnHelper = createColumnHelper<GeneVariant>();

function buildPieOption(title: string, data: LabelCount[]): EChartsOption {
  return {
    title: { text: title, left: "center", textStyle: { fontSize: 14, fontWeight: 800, color: "#232642" } },
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { bottom: 0, type: "scroll", textStyle: { fontSize: 11 } },
    color: CHART_COLORS,
    series: [{
      type: "pie", radius: ["35%", "65%"], center: ["50%", "45%"],
      label: { show: false },
      emphasis: { label: { show: true, fontWeight: "bold" } },
      data: data.map((d) => ({ name: d.label, value: d.count }))
    }]
  };
}

function buildBarOption(title: string, data: LabelCount[]): EChartsOption {
  const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, 15);
  return {
    title: { text: title, left: "center", textStyle: { fontSize: 14, fontWeight: 800, color: "#232642" } },
    tooltip: { trigger: "axis" },
    grid: { left: 80, right: 20, bottom: 40, top: 50 },
    xAxis: { type: "value" },
    yAxis: {
      type: "category", data: sorted.map((d) => d.label).reverse(),
      axisLabel: { fontSize: 11 }
    },
    series: [{
      type: "bar", data: sorted.map((d) => d.count).reverse(),
      itemStyle: { color: ACCENT, borderRadius: [0, 4, 4, 0] },
      emphasis: { itemStyle: { color: WARM } }
    }]
  };
}

export function GeneSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const submittedCancer = searchParams.get("cancer") ?? DEFAULT_CANCER;
  const submittedGene = searchParams.get("gene") ?? DEFAULT_GENE;
  const submittedPage = Number(searchParams.get("page") ?? "1") || 1;

  const [cancer, setCancer] = useState(submittedCancer);
  const [geneInput, setGeneInput] = useState(submittedGene);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const pageSize = 25;

  useEffect(() => {
    setCancer(submittedCancer);
    setGeneInput(submittedGene);
  }, [submittedCancer, submittedGene]);

  /* ---- gene autocomplete ---- */
  const allGenesQuery = useQuery({
    queryKey: ["all-genes", cancer],
    queryFn: () => getAllGenes(cancer),
    staleTime: 10 * 60 * 1000
  });

  const suggestions = useMemo(() => {
    if (!suggestionQuery.trim()) return [];
    const q = suggestionQuery.trim().toUpperCase();
    const pool = allGenesQuery.data && allGenesQuery.data.length > 0
      ? allGenesQuery.data : COMMON_CANCER_GENES;
    return pool.filter((g) => g.toUpperCase().startsWith(q)).slice(0, 12);
  }, [suggestionQuery, allGenesQuery.data]);

  /* ---- gene summary (stats + charts) ---- */
  const summaryQuery = useQuery({
    queryKey: ["gene-summary", submittedCancer, submittedGene],
    queryFn: () => getGeneSummary(submittedCancer, submittedGene),
    enabled: submittedGene.trim().length > 0
  });

  /* ---- variant table ---- */
  const variantsQuery = useQuery({
    queryKey: ["gene-variants", submittedCancer, submittedGene, submittedPage, pageSize],
    queryFn: () => getGeneVariants(submittedCancer, submittedGene, submittedPage, pageSize),
    enabled: submittedGene.trim().length > 0
  });

  const columns = useMemo<ColumnDef<GeneVariant>[]>(() => [
    columnHelper.accessor("gene", { header: "Gene", cell: (info) => <strong>{info.getValue()}</strong> }),
    columnHelper.accessor("chr", { header: "Chr" }),
    columnHelper.accessor("start", { header: "Start" }),
    columnHelper.accessor("end", { header: "End" }),
    columnHelper.accessor("ref", { header: "Ref" }),
    columnHelper.accessor("alt", { header: "Alt" }),
    columnHelper.accessor("func", { header: "Func" }),
    columnHelper.accessor("exonicFunc", {
      header: "Exonic Func",
      cell: (info) => {
        const v = info.getValue();
        return v && v !== "." ? <span className="status-chip">{v}</span> : null;
      }
    }),
    columnHelper.accessor("aaChange", {
      header: "AA Change",
      cell: (info) => {
        const v = info.getValue();
        return v && v !== "." ? <span style={{ fontSize: "0.82rem", fontFamily: "monospace" }}>{v}</span> : "-";
      }
    }),
    columnHelper.accessor("sample", { header: "Sample" })
  ], []);

  /* ---- handlers ---- */
  const handleInputChange = (value: string) => {
    setGeneInput(value);
    setSuggestionQuery(value.trim());
    setShowSuggestions(value.trim().length >= 1);
  };

  const selectSuggestion = (gene: string) => {
    setGeneInput(gene);
    setShowSuggestions(false);
    setSearchParams(new URLSearchParams({ cancer, gene, page: "1" }));
  };

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShowSuggestions(false);
    setSearchParams(new URLSearchParams({
      cancer, gene: geneInput.trim() || DEFAULT_GENE, page: "1"
    }));
  };

  const changePage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(nextPage));
    setSearchParams(params);
  };

  const summary: GeneSummary | undefined = summaryQuery.data;
  const hasData = summary && summary.totalVariants > 0;

  return (
    <div className="page-stack">
      {/* ---- Hero search bar ---- */}
      <div className="gene-hero">
        <div className="gene-hero-content">
          <span className="gene-hero-eyebrow">Gene Profile</span>
          <h1 className="gene-hero-title">
            {submittedGene ? submittedGene : "Search a Gene"}
          </h1>
          <p className="gene-hero-subtitle">
            Deep-dive into a single gene's variant landscape within a cancer cohort.
            View summary statistics, functional distribution, and full variant detail.
          </p>
          <form className="gene-hero-form" onSubmit={submitSearch}>
            <select value={cancer} onChange={(e) => { setCancer(e.target.value); setShowSuggestions(false); }}>
              {CANCER_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="autocomplete-wrapper">
              <input ref={inputRef} value={geneInput}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => geneInput.trim().length >= 1 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Enter gene symbol, e.g. TP53" autoComplete="off" />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="autocomplete-dropdown">
                  {suggestions.map((gene) => (
                    <li key={gene} className="autocomplete-item" onMouseDown={() => selectSuggestion(gene)}>{gene}</li>
                  ))}
                </ul>
              )}
            </div>
            <button className="button-primary" type="submit">View Profile</button>
          </form>
        </div>
      </div>

      {/* ---- Summary stats cards ---- */}
      {summaryQuery.isLoading && <p className="panel-note">Loading gene summary...</p>}
      {summaryQuery.isError && <p className="panel-note">Gene summary is unavailable for this cohort.</p>}

      {hasData && (
        <div className="gene-stat-grid">
          <div className="gene-stat-card gene-stat-highlight">
            <span className="gene-stat-label">Total Variants</span>
            <strong className="gene-stat-value">{formatNumber(summary.totalVariants)}</strong>
          </div>
          <div className="gene-stat-card">
            <span className="gene-stat-label">Unique Samples</span>
            <strong className="gene-stat-value">{formatNumber(summary.uniqueSamples)}</strong>
          </div>
          <div className="gene-stat-card">
            <span className="gene-stat-label">Functional Classes</span>
            <strong className="gene-stat-value">{summary.funcBreakdown.length}</strong>
          </div>
          <div className="gene-stat-card">
            <span className="gene-stat-label">Exonic Types</span>
            <strong className="gene-stat-value">{summary.exonicBreakdown.length}</strong>
          </div>
        </div>
      )}

      {/* ---- Charts ---- */}
      {hasData && (
        <div className="gene-chart-grid">
          {summary.funcBreakdown.length > 0 && (
            <article className="chart-card">
              <ReactECharts option={buildPieOption("Functional Classification", summary.funcBreakdown)}
                style={{ height: 300 }} />
            </article>
          )}
          {summary.exonicBreakdown.length > 0 && (
            <article className="chart-card">
              <ReactECharts option={buildBarOption("Exonic Function Types", summary.exonicBreakdown)}
                style={{ height: 300 }} />
            </article>
          )}
        </div>
      )}

      {/* ---- No data ---- */}
      {summary && summary.totalVariants === 0 && (
        <section className="detail-card empty-card">
          <h3>No variants found for {submittedGene}</h3>
          <p>This gene has no matching rows in the {submittedCancer} aggregate multianno file, or the file has not been generated yet.</p>
        </section>
      )}

      {/* ---- Variant table ---- */}
      {hasData && (
        <>
          <div className="gene-table-header">
            <h2>Variant Detail</h2>
            <span className="gene-table-count">
              {variantsQuery.data ? `${formatNumber(variantsQuery.data.totalElements)} rows` : ""}
            </span>
          </div>

          {variantsQuery.isLoading && <p className="panel-note">Loading variants...</p>}

          {variantsQuery.data && variantsQuery.data.content.length > 0 && (
            <>
              <DataTable data={variantsQuery.data.content} columns={columns} />
              <div className="pagination-bar">
                <button className="button-secondary" disabled={variantsQuery.data.first}
                  onClick={() => changePage(Math.max(submittedPage - 1, 1))}>Previous</button>
                <span>Page {variantsQuery.data.page} / {Math.max(variantsQuery.data.totalPages, 1)}</span>
                <button className="button-secondary" disabled={variantsQuery.data.last}
                  onClick={() => changePage(submittedPage + 1)}>Next</button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
