import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import {
  browseVariants,
  getAllGenes,
  getCancerSummary,
  getChromDistribution,
  getExonicDistribution,
  getFuncDistribution,
  getSampleBurden,
  type BrowseFilters
} from "../api/client";
import { cancerSummaryMock } from "../api/mockData";
import { DataTable } from "../components/DataTable";
import { CANCER_OPTIONS, DEFAULT_CANCER } from "../constants/cfdna";
import { COMMON_CANCER_GENES } from "../constants/genes";
import type { GeneVariant, LabelCount } from "../types/api";
import { formatNumber } from "../utils/format";

const FUNC_OPTIONS = [
  "exonic", "intronic", "intergenic", "UTR3", "UTR5",
  "splicing", "ncRNA_intronic", "ncRNA_exonic", "upstream", "downstream"
];
const EXONIC_FUNC_OPTIONS = [
  "nonsynonymous SNV", "synonymous SNV", "stopgain",
  "stoploss", "frameshift deletion", "frameshift insertion",
  "nonframeshift deletion", "nonframeshift insertion", "unknown"
];
const CHR_OPTIONS = [
  "chr1", "chr2", "chr3", "chr4", "chr5", "chr6", "chr7", "chr8",
  "chr9", "chr10", "chr11", "chr12", "chr13", "chr14", "chr15",
  "chr16", "chr17", "chr18", "chr19", "chr20", "chr21", "chr22",
  "chrX", "chrY"
];
const PAGE_SIZE_OPTIONS = [25, 50, 100];
const DATASET_OPTIONS = [{ value: "multianno", label: "Aggregate Multianno" }];
const ALL_COLUMNS = [
  { key: "gene", label: "Gene" },
  { key: "chr", label: "Chr" },
  { key: "start", label: "Start" },
  { key: "ref", label: "Ref" },
  { key: "alt", label: "Alt" },
  { key: "func", label: "Func" },
  { key: "exonicFunc", label: "Exonic Func" },
  { key: "aaChange", label: "AA Change" },
  { key: "sample", label: "Sample" }
] as const;

type ColKey = typeof ALL_COLUMNS[number]["key"];
const DEFAULT_VISIBLE: ColKey[] = ["gene", "chr", "start", "ref", "alt", "func", "exonicFunc", "aaChange", "sample"];
const PRESETS_KEY = "cfdna-browse-presets";

interface FilterPreset {
  name: string;
  cancer: string;
  dataset: string;
  gene: string;
  funcClass: string;
  exonicFunc: string;
  chr: string;
  sample: string;
  startMin: string;
  startMax: string;
}

interface BrowseListItem {
  label: string;
  count: number;
  note?: string;
  ratio?: number;
  percent?: number;
  active?: boolean;
  onClick?: () => void;
}

function loadPresets(): FilterPreset[] {
  try {
    return JSON.parse(localStorage.getItem(PRESETS_KEY) || "[]");
  } catch {
    return [];
  }
}

function savePresets(presets: FilterPreset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

const columnHelper = createColumnHelper<GeneVariant>();

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function toPanelItems(counts: LabelCount[], limit = 8): BrowseListItem[] {
  const topItems = counts.slice(0, limit);
  const total = counts.reduce((sum, item) => sum + item.count, 0) || 1;
  const max = topItems[0]?.count ?? 0;

  return topItems.map((item) => ({
    label: item.label,
    count: item.count,
    percent: item.count / total,
    ratio: max > 0 ? item.count / max : 0
  }));
}

function makePlaceholderGeneItems() {
  return COMMON_CANCER_GENES.slice(0, 8).map((gene, index) => ({
    label: gene,
    count: 18 - index,
    ratio: (8 - index) / 8
  }));
}

function normalizeCancerLabel(cancer: string) {
  if (cancer === "Colonrector") return "Colorectal";
  if (cancer === "Pdac") return "Pancreas";
  return cancer;
}

function escapeCsvCell(value: string | number | undefined) {
  const text = String(value ?? "");
  if (!text.includes(",") && !text.includes("\"") && !text.includes("\n")) return text;
  return `"${text.replace(/"/g, "\"\"")}"`;
}

const CHART_COLORS = [
  "#44689B",
  "#EA6A2A",
  "#4F9D69",
  "#8D5CC0",
  "#D65A95",
  "#D2A126",
  "#1D8DB5",
  "#7B8798"
];

interface MetricRow {
  label: string;
  count: number;
  freq: string;
  note?: string;
}

function colorForIndex(index: number) {
  return CHART_COLORS[index % CHART_COLORS.length];
}

function shortLabel(label: string) {
  return label.replace(/^chr/i, "").replace(/\s+/g, "").slice(0, 8) || label.slice(0, 8);
}

function buildPieGradient(items: BrowseListItem[]) {
  if (items.length === 0) return "conic-gradient(#e8edf3 0 100%)";

  const total = items.reduce((sum, item) => sum + item.count, 0) || 1;
  let cursor = 0;
  const segments = items.slice(0, 6).map((item, index) => {
    const share = (item.count / total) * 100;
    const start = cursor;
    cursor += share;
    return `${colorForIndex(index)} ${start}% ${cursor}%`;
  });

  if (cursor < 100) segments.push(`#eef2f7 ${cursor}% 100%`);
  return `conic-gradient(${segments.join(", ")})`;
}

export function BrowsePage() {
  const [cancer, setCancer] = useState(DEFAULT_CANCER);
  const [dataset, setDataset] = useState("multianno");
  const [geneInput, setGeneInput] = useState("");
  const [funcClass, setFuncClass] = useState("");
  const [exonicFunc, setExonicFunc] = useState("");
  const [chr, setChr] = useState("");
  const [sampleInput, setSampleInput] = useState("");
  const [startMin, setStartMin] = useState("");
  const [startMax, setStartMax] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const [submitted, setSubmitted] = useState<BrowseFilters & { dataset: string }>({
    cancer: DEFAULT_CANCER,
    dataset: "multianno",
    gene: "",
    funcClass: "",
    exonicFunc: "",
    chr: "",
    sample: "",
    pageSize: 25
  });

  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(new Set(DEFAULT_VISIBLE));
  const [showColMenu, setShowColMenu] = useState(false);
  const [presets, setPresets] = useState<FilterPreset[]>(loadPresets);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const allGenesQuery = useQuery({
    queryKey: ["all-genes", cancer],
    queryFn: () => getAllGenes(cancer),
    staleTime: 10 * 60 * 1000
  });
  const cohortSummaryQuery = useQuery({
    queryKey: ["browse-cancer-summary"],
    queryFn: getCancerSummary,
    staleTime: 5 * 60 * 1000
  });
  const funcDistQuery = useQuery({
    queryKey: ["browse-func-dist", cancer],
    queryFn: () => getFuncDistribution(cancer),
    staleTime: 5 * 60 * 1000
  });
  const exonicDistQuery = useQuery({
    queryKey: ["browse-exonic-dist", cancer],
    queryFn: () => getExonicDistribution(cancer),
    staleTime: 5 * 60 * 1000
  });
  const chromDistQuery = useQuery({
    queryKey: ["browse-chrom-dist", cancer],
    queryFn: () => getChromDistribution(cancer),
    staleTime: 5 * 60 * 1000
  });
  const sampleBurdenQuery = useQuery({
    queryKey: ["browse-sample-burden", cancer],
    queryFn: () => getSampleBurden(cancer, 8),
    staleTime: 5 * 60 * 1000
  });

  const suggestions = useMemo(() => {
    if (!suggestionQuery.trim()) return [];
    const query = suggestionQuery.trim().toUpperCase();
    const pool = allGenesQuery.data && allGenesQuery.data.length > 0 ? allGenesQuery.data : COMMON_CANCER_GENES;
    return pool.filter((gene) => gene.toUpperCase().startsWith(query)).slice(0, 12);
  }, [suggestionQuery, allGenesQuery.data]);

  const variantsQuery = useQuery({
    queryKey: [
      "browse-variants",
      submitted.cancer,
      submitted.gene,
      submitted.funcClass,
      submitted.exonicFunc,
      submitted.chr,
      submitted.sample,
      submitted.startMin,
      submitted.startMax,
      page,
      submitted.pageSize
    ],
    queryFn: () => browseVariants({ ...submitted, page, pageSize: submitted.pageSize ?? 25 })
  });

  const allColumnDefs = useMemo<Record<ColKey, ColumnDef<GeneVariant>>>(() => ({
    gene: columnHelper.accessor("gene", {
      header: "Gene",
      cell: (info) => <strong>{info.getValue()}</strong>
    }),
    chr: columnHelper.accessor("chr", { header: "Chr" }),
    start: columnHelper.accessor("start", { header: "Start" }),
    ref: columnHelper.accessor("ref", { header: "Ref" }),
    alt: columnHelper.accessor("alt", { header: "Alt" }),
    func: columnHelper.accessor("func", { header: "Func" }),
    exonicFunc: columnHelper.accessor("exonicFunc", {
      header: "Exonic Func",
      cell: (info) => {
        const value = info.getValue();
        return value && value !== "." ? <span className="status-chip">{value}</span> : "-";
      }
    }),
    aaChange: columnHelper.accessor("aaChange", {
      header: "AA Change",
      cell: (info) => {
        const value = info.getValue();
        return value && value !== "." ? <span className="browse-mono">{value}</span> : "-";
      }
    }),
    sample: columnHelper.accessor("sample", { header: "Sample" })
  }), []);

  const columns = useMemo<ColumnDef<GeneVariant>[]>(() => (
    ALL_COLUMNS.filter((column) => visibleCols.has(column.key)).map((column) => allColumnDefs[column.key])
  ), [visibleCols, allColumnDefs]);

  const buildSubmitted = (overrides: Partial<BrowseFilters & { dataset: string }> = {}) => ({
    cancer,
    dataset,
    gene: geneInput.trim(),
    funcClass,
    exonicFunc,
    chr,
    sample: sampleInput.trim(),
    startMin: startMin ? Number(startMin) : undefined,
    startMax: startMax ? Number(startMax) : undefined,
    pageSize,
    ...overrides
  });

  const handleGeneInput = (value: string) => {
    setGeneInput(value);
    setSuggestionQuery(value.trim());
    setShowSuggestions(value.trim().length >= 1);
  };

  const selectSuggestion = (gene: string) => {
    setGeneInput(gene);
    setShowSuggestions(false);
  };

  const applySearch = (overrides: Partial<BrowseFilters & { dataset: string }> = {}) => {
    setPage(1);
    setSubmitted(buildSubmitted(overrides));
  };

  const applyFacetSelection = (overrides: Partial<BrowseFilters & { cancer: string }> = {}) => {
    if (overrides.cancer !== undefined) setCancer(overrides.cancer);
    if (overrides.gene !== undefined) setGeneInput(overrides.gene);
    if (overrides.funcClass !== undefined) setFuncClass(overrides.funcClass);
    if (overrides.exonicFunc !== undefined) setExonicFunc(overrides.exonicFunc);
    if (overrides.chr !== undefined) setChr(overrides.chr);
    if (overrides.sample !== undefined) setSampleInput(overrides.sample);
    setShowSuggestions(false);
    applySearch(overrides);
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setShowSuggestions(false);
    applySearch();
  };

  const resetFilters = () => {
    setCancer(DEFAULT_CANCER);
    setDataset("multianno");
    setGeneInput("");
    setFuncClass("");
    setExonicFunc("");
    setChr("");
    setSampleInput("");
    setStartMin("");
    setStartMax("");
    setPageSize(25);
    setPage(1);
    setSubmitted({
      cancer: DEFAULT_CANCER,
      dataset: "multianno",
      gene: "",
      funcClass: "",
      exonicFunc: "",
      chr: "",
      sample: "",
      pageSize: 25
    });
  };

  const removeFilter = (key: string) => {
    if (key === "gene") setGeneInput("");
    if (key === "funcClass") setFuncClass("");
    if (key === "exonicFunc") setExonicFunc("");
    if (key === "chr") setChr("");
    if (key === "sample") setSampleInput("");
    if (key === "position") {
      setStartMin("");
      setStartMax("");
    }

    setPage(1);
    setSubmitted((previous) => {
      const next = { ...previous };
      if (key === "gene") next.gene = "";
      if (key === "funcClass") next.funcClass = "";
      if (key === "exonicFunc") next.exonicFunc = "";
      if (key === "chr") next.chr = "";
      if (key === "sample") next.sample = "";
      if (key === "position") {
        next.startMin = undefined;
        next.startMax = undefined;
      }
      return next;
    });
  };

  const selectCohort = (nextCancer: string) => {
    applyFacetSelection({ cancer: nextCancer });
  };

  const toggleCol = (key: ColKey) => {
    setVisibleCols((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const saveCurrentAsPreset = () => {
    if (!presetName.trim()) return;
    const preset: FilterPreset = {
      name: presetName.trim(),
      cancer,
      dataset,
      gene: geneInput.trim(),
      funcClass,
      exonicFunc,
      chr,
      sample: sampleInput.trim(),
      startMin,
      startMax
    };
    const updated = [...presets.filter((item) => item.name !== preset.name), preset];
    setPresets(updated);
    savePresets(updated);
    setPresetName("");
    setShowPresetMenu(false);
  };

  const loadPreset = (preset: FilterPreset) => {
    setCancer(preset.cancer);
    setDataset(preset.dataset);
    setGeneInput(preset.gene);
    setFuncClass(preset.funcClass);
    setExonicFunc(preset.exonicFunc);
    setChr(preset.chr);
    setSampleInput(preset.sample);
    setStartMin(preset.startMin);
    setStartMax(preset.startMax);
    setPage(1);
    setSubmitted({
      cancer: preset.cancer,
      dataset: preset.dataset,
      gene: preset.gene,
      funcClass: preset.funcClass,
      exonicFunc: preset.exonicFunc,
      chr: preset.chr,
      sample: preset.sample,
      startMin: preset.startMin ? Number(preset.startMin) : undefined,
      startMax: preset.startMax ? Number(preset.startMax) : undefined,
      pageSize
    });
    setShowPresetMenu(false);
  };

  const deletePreset = (name: string) => {
    const updated = presets.filter((item) => item.name !== name);
    setPresets(updated);
    savePresets(updated);
  };

  const changePageSize = (nextPageSize: number) => {
    setPageSize(nextPageSize);
    setPage(1);
    setSubmitted((previous) => ({ ...previous, pageSize: nextPageSize }));
  };

  const exportCsv = () => {
    const rows = variantsQuery.data?.content ?? [];
    if (rows.length === 0) return;

    const visibleKeys = ALL_COLUMNS.filter((column) => visibleCols.has(column.key));
    const header = visibleKeys.map((column) => escapeCsvCell(column.label));
    const body = rows.map((row) => visibleKeys.map((column) => escapeCsvCell((row as Record<string, string>)[column.key])));
    const csv = [header, ...body].map((line) => line.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${submitted.cancer}_variants_export.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const data = variantsQuery.data;
  const rows = data?.content ?? [];
  const cohortSummary = cohortSummaryQuery.data ?? cancerSummaryMock;
  const selectedCohortSummary = cohortSummary.find((item) => item.cancer === submitted.cancer) ?? cohortSummary[0];
  const uniqueGenesOnPage = new Set(rows.map((row) => row.gene)).size;
  const uniqueSamplesOnPage = new Set(rows.map((row) => row.sample)).size;
  const exonicOnPage = rows.filter((row) => row.func === "exonic").length;

  const activeFilters: { key: string; label: string; value: string }[] = [];
  if (submitted.gene) activeFilters.push({ key: "gene", label: "Gene", value: submitted.gene });
  if (submitted.funcClass) activeFilters.push({ key: "funcClass", label: "Func", value: submitted.funcClass });
  if (submitted.exonicFunc) activeFilters.push({ key: "exonicFunc", label: "Exonic", value: submitted.exonicFunc });
  if (submitted.chr) activeFilters.push({ key: "chr", label: "Chr", value: submitted.chr });
  if (submitted.sample) activeFilters.push({ key: "sample", label: "Sample", value: submitted.sample });
  if (submitted.startMin != null || submitted.startMax != null) {
    activeFilters.push({
      key: "position",
      label: "Position",
      value: `${submitted.startMin ?? "..."} - ${submitted.startMax ?? "..."}`
    });
  }

  const cohortTotal = cohortSummary.reduce((sum, item) => sum + item.sampleCount, 0) || 1;

  const cohortItems = useMemo<BrowseListItem[]>(() => {
    const maxCount = Math.max(...cohortSummary.map((item) => item.sampleCount), 1);
    return cohortSummary.map((item) => ({
      label: normalizeCancerLabel(item.cancer),
      count: item.sampleCount,
      note: item.annotatedCount > 0 ? "ready" : "pending",
      ratio: item.sampleCount / maxCount,
      percent: item.sampleCount / cohortTotal,
      active: item.cancer === submitted.cancer,
      onClick: () => selectCohort(item.cancer)
    }));
  }, [cohortSummary, cohortTotal, submitted.cancer]);

  const funcItems = useMemo(() => {
    const primary = funcDistQuery.data ?? [];
    const items = primary.length > 0 ? toPanelItems(primary, 8) : toPanelItems(countBy(rows.map((row) => row.func)), 8);
    return items.map((item) => ({
      ...item,
      active: item.label === submitted.funcClass,
      onClick: () => applyFacetSelection({ funcClass: submitted.funcClass === item.label ? "" : item.label })
    }));
  }, [funcDistQuery.data, rows, submitted.funcClass]);

  const geneItems = useMemo(() => {
    const geneCounts = countBy(rows.map((row) => row.gene));
    const items = geneCounts.length > 0 ? toPanelItems(geneCounts, 8) : makePlaceholderGeneItems();
    return items.map((item) => ({
      ...item,
      active: item.label === submitted.gene,
      onClick: () => applyFacetSelection({ gene: submitted.gene === item.label ? "" : item.label })
    }));
  }, [rows, submitted.gene]);

  const exonicItems = useMemo(() => {
    const primary = exonicDistQuery.data ?? [];
    const fallback = countBy(rows.map((row) => row.exonicFunc).filter((value) => value && value !== "."));
    const items = primary.length > 0 ? toPanelItems(primary, 8) : toPanelItems(fallback, 8);
    return items.map((item) => ({
      ...item,
      active: item.label === submitted.exonicFunc,
      onClick: () => applyFacetSelection({ exonicFunc: submitted.exonicFunc === item.label ? "" : item.label })
    }));
  }, [exonicDistQuery.data, rows, submitted.exonicFunc]);

  const chromosomeItems = useMemo(() => {
    const primary = chromDistQuery.data ?? [];
    const items = primary.length > 0 ? toPanelItems(primary, 8) : toPanelItems(countBy(rows.map((row) => row.chr)), 8);
    return items.map((item) => ({
      ...item,
      active: item.label === submitted.chr,
      onClick: () => applyFacetSelection({ chr: submitted.chr === item.label ? "" : item.label })
    }));
  }, [chromDistQuery.data, rows, submitted.chr]);

  const sampleItems = useMemo(() => {
    const primary = sampleBurdenQuery.data ?? [];
    const items = primary.length > 0 ? toPanelItems(primary, 8) : toPanelItems(countBy(rows.map((row) => row.sample)), 8);
    return items.map((item) => ({
      ...item,
      active: item.label === submitted.sample,
      onClick: () => applyFacetSelection({ sample: submitted.sample === item.label ? "" : item.label })
    }));
  }, [sampleBurdenQuery.data, rows, submitted.sample]);

  const selectedSampleCount = uniqueSamplesOnPage || selectedCohortSummary?.sampleCount || 0;
  const profileBase = Math.max(selectedCohortSummary?.totalDataFiles ?? 0, 1);
  const sampleBase = Math.max(selectedCohortSummary?.sampleCount ?? 0, 1);
  const profileRows: MetricRow[] = [
    { label: "Cohort samples", count: selectedCohortSummary?.sampleCount ?? 0, freq: "100.0%" },
    {
      label: "Annotated files",
      count: selectedCohortSummary?.annotatedCount ?? 0,
      freq: selectedCohortSummary?.totalDataFiles ? formatPercent((selectedCohortSummary.annotatedCount ?? 0) / profileBase) : "0.0%"
    },
    {
      label: "Somatic files",
      count: selectedCohortSummary?.somaticCount ?? 0,
      freq: selectedCohortSummary?.totalDataFiles ? formatPercent((selectedCohortSummary.somaticCount ?? 0) / profileBase) : "0.0%"
    },
    {
      label: "Matched variants",
      count: data?.totalElements ?? 0,
      freq: formatPercent((uniqueSamplesOnPage || 0) / sampleBase)
    },
    {
      label: "Genes on page",
      count: uniqueGenesOnPage,
      freq: rows.length ? formatPercent(exonicOnPage / rows.length) : "0.0%",
      note: "exonic share"
    }
  ];

  const compactSummary = [
    normalizeCancerLabel(submitted.cancer),
    submitted.gene || "All genes",
    submitted.funcClass || "All functions",
    submitted.chr || "All chromosomes"
  ].join(" | ");

  return (
    <div className="page-stack browse-dense-page">
      <form className="browse-dense-top-shell" onSubmit={submitSearch}>
        <section className="detail-card browse-dense-topbar">
          <div className="browse-dense-title">
            <h2>cfDNA Variant Browser</h2>
            <p>cfDNA Atlas - cohort-level somatic mutation set accessible</p>
          </div>
          <div className="browse-dense-query">
            <div className="autocomplete-wrapper">
              <input
                ref={inputRef}
                value={geneInput}
                onChange={(event) => handleGeneInput(event.target.value)}
                onFocus={() => geneInput.trim().length >= 1 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Click gene symbols below or enter here"
                autoComplete="off"
              />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="autocomplete-dropdown">
                  {suggestions.map((gene) => (
                    <li key={gene} className="autocomplete-item" onMouseDown={() => selectSuggestion(gene)}>{gene}</li>
                  ))}
                </ul>
              )}
            </div>
            <button className="button-secondary" type="submit">Query</button>
          </div>
        </section>

        <section className="detail-card browse-dense-toolbar">
          <div className="browse-dense-tabs">
            <button type="button" className="browse-dense-tab browse-dense-tab-active">Summary</button>
            <button type="button" className="browse-dense-tab">Variant Table</button>
            <button type="button" className="browse-dense-tab browse-dense-tab-beta">Plots Beta!</button>
          </div>
          <div className="browse-dense-toolbar-right">
            <span className="browse-dense-selection">
              Selected: {formatNumber(data?.totalElements ?? 0)} variants | {formatNumber(selectedSampleCount)} samples
            </span>
            <div className="browse-dense-actions">
              <label className="browse-field-inline">
                <span>Rows</span>
                <select value={pageSize} onChange={(event) => changePageSize(Number(event.target.value))}>
                  {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
              <button className="button-secondary" type="button" onClick={resetFilters}>Reset</button>
              <button className="button-secondary" type="button" onClick={exportCsv} disabled={rows.length === 0}>Export</button>
              <div className="browse-dropdown-wrap">
                <button className="button-secondary" type="button" onClick={() => { setShowColMenu(!showColMenu); setShowPresetMenu(false); }}>
                  Columns
                </button>
                {showColMenu && (
                  <div className="browse-dropdown-menu">
                    {ALL_COLUMNS.map((column) => (
                      <label key={column.key} className="browse-dropdown-item">
                        <input type="checkbox" checked={visibleCols.has(column.key)} onChange={() => toggleCol(column.key)} />
                        {column.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="browse-dropdown-wrap">
                <button className="button-secondary" type="button" onClick={() => { setShowPresetMenu(!showPresetMenu); setShowColMenu(false); }}>
                  Presets
                </button>
                {showPresetMenu && (
                  <div className="browse-dropdown-menu browse-preset-menu">
                    <div className="browse-preset-save">
                      <input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Preset name" />
                      <button type="button" className="button-primary browse-preset-save-btn" onClick={saveCurrentAsPreset}>
                        Save
                      </button>
                    </div>
                    {presets.length === 0 && <p className="browse-preset-empty">No saved presets</p>}
                    {presets.map((preset) => (
                      <div key={preset.name} className="browse-preset-row">
                        <button type="button" className="browse-preset-load" onClick={() => loadPreset(preset)}>
                          <strong>{preset.name}</strong>
                          <span>
                            {normalizeCancerLabel(preset.cancer)}
                            {preset.gene ? ` / ${preset.gene}` : ""}
                            {preset.funcClass ? ` / ${preset.funcClass}` : ""}
                          </span>
                        </button>
                        <button type="button" className="browse-preset-delete" onClick={() => deletePreset(preset.name)}>&times;</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="detail-card browse-dense-filterbar">
          <label className="browse-field">
            <span>Cancer Cohort</span>
            <select value={cancer} onChange={(event) => setCancer(event.target.value)}>
              {CANCER_OPTIONS.map((option) => <option key={option} value={option}>{normalizeCancerLabel(option)}</option>)}
            </select>
          </label>
          <label className="browse-field">
            <span>Dataset</span>
            <select value={dataset} onChange={(event) => setDataset(event.target.value)}>
              {DATASET_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="browse-field">
            <span>Functional Class</span>
            <select value={funcClass} onChange={(event) => setFuncClass(event.target.value)}>
              <option value="">All classes</option>
              {FUNC_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="browse-field">
            <span>Exonic Function</span>
            <select value={exonicFunc} onChange={(event) => setExonicFunc(event.target.value)}>
              <option value="">All exonic types</option>
              {EXONIC_FUNC_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="browse-field">
            <span>Chromosome</span>
            <select value={chr} onChange={(event) => setChr(event.target.value)}>
              <option value="">All chromosomes</option>
              {CHR_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="browse-field">
            <span>Sample Barcode</span>
            <input value={sampleInput} onChange={(event) => setSampleInput(event.target.value)} placeholder="Sample ID" autoComplete="off" />
          </label>
          <label className="browse-field">
            <span>Position Min</span>
            <input type="number" value={startMin} onChange={(event) => setStartMin(event.target.value)} placeholder="Start" />
          </label>
          <label className="browse-field">
            <span>Position Max</span>
            <input type="number" value={startMax} onChange={(event) => setStartMax(event.target.value)} placeholder="End" />
          </label>
        </section>
      </form>

      {activeFilters.length > 0 && (
        <div className="browse-active-filters browse-dense-filters">
          <span className="browse-filters-label">{compactSummary}</span>
          {activeFilters.map((filter) => (
            <button key={filter.key} className="browse-filter-pill" onClick={() => removeFilter(filter.key)} type="button">
              {filter.label}: {filter.value} &times;
            </button>
          ))}
        </div>
      )}

      <section className="browse-dense-grid">
        <FacetPanel className="browse-area-cancer" title="Cancer Type" headerLabel="Cancer Type" items={cohortItems} emptyText="No cohort data." />
        <FacetPanel className="browse-area-func" title="Functional Class" headerLabel="Annotation Class" items={funcItems} emptyText="No functional summary." />
        <MetricTablePanel className="browse-area-profile" title="Genomic Profile Sample Counts" rows={profileRows} />
        <PiePanel className="browse-area-cohort" title="Cohort Composition" items={cohortItems.slice(0, 6)} emptyText="No cohort composition available." />
        <FacetPanel className="browse-area-genes" title={`Mutated Genes (${formatNumber(selectedSampleCount)} samples)`} headerLabel="Gene" items={geneItems} emptyText="Run a query to populate genes." />
        <FacetPanel className="browse-area-exonic" title="Exonic Consequence" headerLabel="Consequence" items={exonicItems} emptyText="No exonic consequence summary." />
        <PreviewTablePanel className="browse-area-preview" title="Variant Preview" rows={rows.slice(0, 8)} />
        <MiniBarPanel className="browse-area-samplebars" title="Variants Per Sample" items={sampleItems.slice(0, 8)} emptyText="No sample burden summary." />
        <FacetPanel className="browse-area-samples" title="Top Samples" headerLabel="Sample Barcode" items={sampleItems} emptyText="No sample list available." />
        <FacetPanel className="browse-area-chrom" title="Chromosome Burden" headerLabel="Chromosome" items={chromosomeItems} emptyText="No chromosome summary." />
        <MiniBarPanel className="browse-area-hist" title="Mutation Count" items={chromosomeItems.slice(0, 8)} emptyText="No mutation count histogram." />
      </section>

      <section className="detail-card browse-dense-results">
        <div className="browse-dense-results-header">
          <div>
            <strong>Variant Table</strong>
            <p>{data ? `${formatNumber(data.totalElements)} matching variants` : "Run a query to populate the result table."}</p>
          </div>
        </div>

        {variantsQuery.isLoading && <p className="panel-note">Loading variants...</p>}
        {variantsQuery.isError && (
          <p className="panel-note">
            Variant browse is unavailable for {normalizeCancerLabel(submitted.cancer)}. The aggregate multianno file may not be ready yet.
          </p>
        )}

        {rows.length > 0 ? (
          <>
            <DataTable data={rows} columns={columns} />
            <div className="pagination-bar">
              <button className="button-secondary" type="button" disabled={data?.first} onClick={() => setPage((previous) => Math.max(previous - 1, 1))}>
                Previous
              </button>
              <span>Page {data?.page ?? 1} / {Math.max(data?.totalPages ?? 1, 1)}</span>
              <button className="button-secondary" type="button" disabled={data?.last} onClick={() => setPage((previous) => previous + 1)}>
                Next
              </button>
            </div>
          </>
        ) : (
          !variantsQuery.isLoading && (
            <div className="browse-empty-state">
              <h4>No matching variants</h4>
              <p>Try a broader cohort query, remove the gene constraint, or clear position range filters.</p>
            </div>
          )
        )}
      </section>
    </div>
  );
}

function DensePanel({
  className,
  title,
  children
}: {
  className?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={`detail-card browse-dense-panel${className ? ` ${className}` : ""}`}>
      <div className="browse-dense-panel-header">
        <strong>{title}</strong>
      </div>
      <div className="browse-dense-panel-body">{children}</div>
    </section>
  );
}

function FacetPanel({
  className,
  title,
  headerLabel,
  items,
  emptyText
}: {
  className?: string;
  title: string;
  headerLabel: string;
  items: BrowseListItem[];
  emptyText: string;
}) {
  return (
    <DensePanel className={className} title={title}>
      {items.length === 0 ? (
        <p className="browse-empty-copy">{emptyText}</p>
      ) : (
        <div className="browse-facet-table">
          <div className="browse-facet-header">
            <span>{headerLabel}</span>
            <span>#</span>
            <span>Freq</span>
          </div>
          <div className="browse-facet-rows">
            {items.map((item, index) => {
              const Wrapper = item.onClick ? "button" : "div";
              return (
                <Wrapper
                  key={item.label}
                  className={`browse-facet-row${item.active ? " browse-facet-row-active" : ""}${item.onClick ? " browse-facet-row-clickable" : ""}`}
                  {...(item.onClick ? { onClick: item.onClick, type: "button" as const } : {})}
                >
                  <div className="browse-facet-main">
                    <span className="browse-facet-swatch" style={{ backgroundColor: colorForIndex(index) }} />
                    <div className="browse-facet-copy">
                      <strong>{item.label}</strong>
                      {item.note && <span>{item.note}</span>}
                    </div>
                  </div>
                  <span>{formatNumber(item.count)}</span>
                  <span>{item.percent != null ? formatPercent(item.percent) : "-"}</span>
                </Wrapper>
              );
            })}
          </div>
        </div>
      )}
    </DensePanel>
  );
}

function MetricTablePanel({
  className,
  title,
  rows
}: {
  className?: string;
  title: string;
  rows: MetricRow[];
}) {
  return (
    <DensePanel className={className} title={title}>
      <div className="browse-facet-table">
        <div className="browse-facet-header">
          <span>Metric</span>
          <span>#</span>
          <span>Freq</span>
        </div>
        <div className="browse-facet-rows">
          {rows.map((row) => (
            <div key={row.label} className="browse-facet-row">
              <div className="browse-facet-main">
                <div className="browse-facet-copy">
                  <strong>{row.label}</strong>
                  {row.note && <span>{row.note}</span>}
                </div>
              </div>
              <span>{formatNumber(row.count)}</span>
              <span>{row.freq}</span>
            </div>
          ))}
        </div>
      </div>
    </DensePanel>
  );
}

function PreviewTablePanel({
  className,
  title,
  rows
}: {
  className?: string;
  title: string;
  rows: GeneVariant[];
}) {
  return (
    <DensePanel className={className} title={title}>
      {rows.length === 0 ? (
        <p className="browse-empty-copy">No variant rows on the current page.</p>
      ) : (
        <div className="browse-preview-scroll">
          <table className="browse-preview-table">
            <thead>
              <tr>
                <th>Gene</th>
                <th>Chr</th>
                <th>Position</th>
                <th>Allele</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.gene}-${row.chr}-${row.start}-${index}`}>
                  <td>{row.gene}</td>
                  <td>{row.chr}</td>
                  <td>{row.start}</td>
                  <td>{row.ref}&gt;{row.alt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DensePanel>
  );
}

function PiePanel({
  className,
  title,
  items,
  emptyText
}: {
  className?: string;
  title: string;
  items: BrowseListItem[];
  emptyText: string;
}) {
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <DensePanel className={className} title={title}>
      {items.length === 0 ? (
        <p className="browse-empty-copy">{emptyText}</p>
      ) : (
        <div className="browse-pie-layout">
          <div className="browse-pie-chart" style={{ backgroundImage: buildPieGradient(items) }}>
            <span>{formatNumber(total)}</span>
          </div>
          <div className="browse-pie-legend">
            {items.map((item, index) => (
              <div key={item.label} className="browse-pie-legend-row">
                <span className="browse-facet-swatch" style={{ backgroundColor: colorForIndex(index) }} />
                <strong>{item.label}</strong>
                <span>{item.percent != null ? formatPercent(item.percent) : "-"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </DensePanel>
  );
}

function MiniBarPanel({
  className,
  title,
  items,
  emptyText
}: {
  className?: string;
  title: string;
  items: BrowseListItem[];
  emptyText: string;
}) {
  return (
    <DensePanel className={className} title={title}>
      {items.length === 0 ? (
        <p className="browse-empty-copy">{emptyText}</p>
      ) : (
        <div className="browse-mini-bars">
          {items.map((item, index) => (
            <div key={item.label} className="browse-mini-bar-col">
              <span>{formatNumber(item.count)}</span>
              <div className="browse-mini-bar-track">
                <div className="browse-mini-bar-fill" style={{ height: `${Math.max(12, Math.round((item.ratio ?? 0) * 100))}%`, backgroundColor: colorForIndex(index) }} />
              </div>
              <strong>{shortLabel(item.label)}</strong>
            </div>
          ))}
        </div>
      )}
    </DensePanel>
  );
}

function formatPercent(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}
