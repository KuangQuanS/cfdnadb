import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { browseVariants, getAllGenes, type BrowseFilters } from "../api/client";
import { DataTable } from "../components/DataTable";
import { SectionHeader } from "../components/SectionHeader";
import { CANCER_OPTIONS, DEFAULT_CANCER } from "../constants/cfdna";
import { COMMON_CANCER_GENES } from "../constants/genes";
import type { GeneVariant } from "../types/api";
import { formatNumber } from "../utils/format";

/* ---- static option lists ---- */
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

/* ---- column keys for visibility toggle ---- */
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

/* ---- preset storage ---- */
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

function loadPresets(): FilterPreset[] {
  try {
    return JSON.parse(localStorage.getItem(PRESETS_KEY) || "[]");
  } catch { return []; }
}
function savePresets(presets: FilterPreset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

const columnHelper = createColumnHelper<GeneVariant>();

export function BrowsePage() {
  /* ---- local filter state ---- */
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

  /* ---- submitted (applied) state ---- */
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

  /* ---- column visibility ---- */
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(new Set(DEFAULT_VISIBLE));
  const [showColMenu, setShowColMenu] = useState(false);

  /* ---- presets ---- */
  const [presets, setPresets] = useState<FilterPreset[]>(loadPresets);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [presetName, setPresetName] = useState("");

  /* ---- autocomplete ---- */
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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

  /* ---- data query ---- */
  const variantsQuery = useQuery({
    queryKey: ["browse-variants", submitted.cancer, submitted.gene, submitted.funcClass,
      submitted.exonicFunc, submitted.chr, submitted.sample,
      submitted.startMin, submitted.startMax, page, submitted.pageSize],
    queryFn: () => browseVariants({ ...submitted, page, pageSize: submitted.pageSize ?? 25 }),
    enabled: true
  });

  /* ---- columns (filtered by visibility) ---- */
  const allColumnDefs = useMemo<Record<ColKey, ColumnDef<GeneVariant>>>(() => ({
    gene: columnHelper.accessor("gene", {
      header: "Gene", cell: (info) => <strong>{info.getValue()}</strong>
    }),
    chr: columnHelper.accessor("chr", { header: "Chr" }),
    start: columnHelper.accessor("start", { header: "Start" }),
    ref: columnHelper.accessor("ref", { header: "Ref" }),
    alt: columnHelper.accessor("alt", { header: "Alt" }),
    func: columnHelper.accessor("func", { header: "Func" }),
    exonicFunc: columnHelper.accessor("exonicFunc", {
      header: "Exonic Func",
      cell: (info) => {
        const v = info.getValue();
        return v && v !== "." ? <span className="status-chip">{v}</span> : null;
      }
    }),
    aaChange: columnHelper.accessor("aaChange", {
      header: "AA Change",
      cell: (info) => {
        const v = info.getValue();
        return v && v !== "." ? <span style={{ fontSize: "0.82rem", fontFamily: "monospace" }}>{v}</span> : "-";
      }
    }),
    sample: columnHelper.accessor("sample", { header: "Sample" })
  }), []);

  const columns = useMemo<ColumnDef<GeneVariant>[]>(
    () => ALL_COLUMNS.filter((c) => visibleCols.has(c.key)).map((c) => allColumnDefs[c.key]),
    [visibleCols, allColumnDefs]
  );

  /* ---- handlers ---- */
  const handleGeneInput = (value: string) => {
    setGeneInput(value);
    setSuggestionQuery(value.trim());
    setShowSuggestions(value.trim().length >= 1);
  };

  const selectSuggestion = (gene: string) => {
    setGeneInput(gene);
    setShowSuggestions(false);
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setShowSuggestions(false);
    setPage(1);
    setSubmitted({
      cancer, dataset, gene: geneInput.trim(), funcClass, exonicFunc, chr,
      sample: sampleInput.trim(),
      startMin: startMin ? Number(startMin) : undefined,
      startMax: startMax ? Number(startMax) : undefined,
      pageSize
    });
  };

  const resetFilters = () => {
    setCancer(DEFAULT_CANCER); setDataset("multianno");
    setGeneInput(""); setFuncClass(""); setExonicFunc(""); setChr("");
    setSampleInput(""); setStartMin(""); setStartMax("");
    setPageSize(25); setPage(1);
    setSubmitted({ cancer: DEFAULT_CANCER, dataset: "multianno", gene: "", funcClass: "", exonicFunc: "", chr: "", sample: "", pageSize: 25 });
  };

  const removeFilter = (key: string) => {
    if (key === "gene") setGeneInput("");
    if (key === "funcClass") setFuncClass("");
    if (key === "exonicFunc") setExonicFunc("");
    if (key === "chr") setChr("");
    if (key === "sample") setSampleInput("");
    if (key === "position") { setStartMin(""); setStartMax(""); }
    setPage(1);
    setSubmitted((prev) => {
      const next = { ...prev };
      if (key === "gene") next.gene = "";
      if (key === "funcClass") next.funcClass = "";
      if (key === "exonicFunc") next.exonicFunc = "";
      if (key === "chr") next.chr = "";
      if (key === "sample") next.sample = "";
      if (key === "position") { next.startMin = undefined; next.startMax = undefined; }
      return next;
    });
  };

  const toggleCol = (key: ColKey) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      return next;
    });
  };

  /* ---- presets ---- */
  const saveCurrentAsPreset = () => {
    if (!presetName.trim()) return;
    const preset: FilterPreset = {
      name: presetName.trim(), cancer, dataset, gene: geneInput.trim(),
      funcClass, exonicFunc, chr, sample: sampleInput.trim(),
      startMin, startMax
    };
    const updated = [...presets.filter((p) => p.name !== preset.name), preset];
    setPresets(updated);
    savePresets(updated);
    setPresetName("");
    setShowPresetMenu(false);
  };

  const loadPreset = (preset: FilterPreset) => {
    setCancer(preset.cancer); setDataset(preset.dataset);
    setGeneInput(preset.gene); setFuncClass(preset.funcClass);
    setExonicFunc(preset.exonicFunc); setChr(preset.chr);
    setSampleInput(preset.sample);
    setStartMin(preset.startMin); setStartMax(preset.startMax);
    setPage(1);
    setSubmitted({
      cancer: preset.cancer, dataset: preset.dataset,
      gene: preset.gene, funcClass: preset.funcClass,
      exonicFunc: preset.exonicFunc, chr: preset.chr,
      sample: preset.sample,
      startMin: preset.startMin ? Number(preset.startMin) : undefined,
      startMax: preset.startMax ? Number(preset.startMax) : undefined,
      pageSize
    });
    setShowPresetMenu(false);
  };

  const deletePreset = (name: string) => {
    const updated = presets.filter((p) => p.name !== name);
    setPresets(updated);
    savePresets(updated);
  };

  const exportCsv = () => {
    const rows = variantsQuery.data?.content ?? [];
    const visKeys = ALL_COLUMNS.filter((c) => visibleCols.has(c.key));
    const header = visKeys.map((c) => c.label);
    const body = rows.map((r) => visKeys.map((c) => (r as Record<string, string>)[c.key] ?? ""));
    const csv = [header, ...body].map((line) => line.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${submitted.cancer}_variants_export.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const data = variantsQuery.data;

  /* ---- active filter pills ---- */
  const activeFilters: { key: string; label: string; value: string }[] = [];
  if (submitted.gene) activeFilters.push({ key: "gene", label: "Gene", value: submitted.gene });
  if (submitted.funcClass) activeFilters.push({ key: "funcClass", label: "Func", value: submitted.funcClass });
  if (submitted.exonicFunc) activeFilters.push({ key: "exonicFunc", label: "Exonic", value: submitted.exonicFunc });
  if (submitted.chr) activeFilters.push({ key: "chr", label: "Chr", value: submitted.chr });
  if (submitted.sample) activeFilters.push({ key: "sample", label: "Sample", value: submitted.sample });
  if (submitted.startMin != null || submitted.startMax != null) {
    const range = `${submitted.startMin ?? "..."} - ${submitted.startMax ?? "..."}`;
    activeFilters.push({ key: "position", label: "Position", value: range });
  }

  return (
    <div className="page-stack">
      <SectionHeader
        eyebrow="Browse"
        title="Variant Browser"
        description="Explore cfDNA variant annotations across cancer cohorts. Filter by gene, genomic region, functional class, and more."
      />

      {/* ---- Filter Panel ---- */}
      <form className="browse-filter-panel" onSubmit={submitSearch}>
        {/* Row 1: Cancer, Dataset, Chromosome */}
        <div className="browse-filter-row">
          <label className="browse-field">
            <span>Cancer Cohort</span>
            <select value={cancer} onChange={(e) => { setCancer(e.target.value); setShowSuggestions(false); }}>
              {CANCER_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="browse-field">
            <span>Dataset</span>
            <select value={dataset} onChange={(e) => setDataset(e.target.value)}>
              {DATASET_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </label>
          <label className="browse-field">
            <span>Chromosome</span>
            <select value={chr} onChange={(e) => setChr(e.target.value)}>
              <option value="">All chromosomes</option>
              {CHR_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>

        {/* Row 2: Gene, Func, Exonic */}
        <div className="browse-filter-row">
          <div className="browse-field browse-field-gene">
            <span>Gene Symbol</span>
            <div className="autocomplete-wrapper">
              <input ref={inputRef} value={geneInput}
                onChange={(e) => handleGeneInput(e.target.value)}
                onFocus={() => geneInput.trim().length >= 1 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="e.g. TP53, KRAS, EGFR" autoComplete="off" />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="autocomplete-dropdown">
                  {suggestions.map((gene) => (
                    <li key={gene} className="autocomplete-item" onMouseDown={() => selectSuggestion(gene)}>{gene}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <label className="browse-field">
            <span>Functional Class</span>
            <select value={funcClass} onChange={(e) => setFuncClass(e.target.value)}>
              <option value="">All classes</option>
              {FUNC_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label className="browse-field">
            <span>Exonic Function</span>
            <select value={exonicFunc} onChange={(e) => setExonicFunc(e.target.value)}>
              <option value="">All exonic types</option>
              {EXONIC_FUNC_OPTIONS.map((ef) => <option key={ef} value={ef}>{ef}</option>)}
            </select>
          </label>
        </div>

        {/* Row 3: Sample, Position Range */}
        <div className="browse-filter-row">
          <label className="browse-field">
            <span>Sample Barcode</span>
            <input value={sampleInput} onChange={(e) => setSampleInput(e.target.value)}
              placeholder="e.g. TCGA-A1-A0SK" autoComplete="off" />
          </label>
          <label className="browse-field">
            <span>Position Min</span>
            <input type="number" value={startMin} onChange={(e) => setStartMin(e.target.value)}
              placeholder="Start ≥" />
          </label>
          <label className="browse-field">
            <span>Position Max</span>
            <input type="number" value={startMax} onChange={(e) => setStartMax(e.target.value)}
              placeholder="Start ≤" />
          </label>
        </div>

        {/* Row 4: Actions */}
        <div className="browse-actions-row">
          <div className="browse-actions-left">
            <button className="button-primary" type="submit">Search</button>
            <button className="button-secondary" type="button" onClick={resetFilters}>Reset</button>
            <button className="button-secondary" type="button" onClick={exportCsv}
              disabled={!data || data.content.length === 0}>Export CSV</button>

            {/* Column visibility toggle */}
            <div className="browse-dropdown-wrap">
              <button className="button-secondary" type="button" onClick={() => { setShowColMenu(!showColMenu); setShowPresetMenu(false); }}>
                Columns
              </button>
              {showColMenu && (
                <div className="browse-dropdown-menu">
                  {ALL_COLUMNS.map((c) => (
                    <label key={c.key} className="browse-dropdown-item">
                      <input type="checkbox" checked={visibleCols.has(c.key)}
                        onChange={() => toggleCol(c.key)} />
                      {c.label}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Preset menu */}
            <div className="browse-dropdown-wrap">
              <button className="button-secondary" type="button" onClick={() => { setShowPresetMenu(!showPresetMenu); setShowColMenu(false); }}>
                Presets
              </button>
              {showPresetMenu && (
                <div className="browse-dropdown-menu browse-preset-menu">
                  <div className="browse-preset-save">
                    <input value={presetName} onChange={(e) => setPresetName(e.target.value)}
                      placeholder="Preset name" />
                    <button type="button" className="button-primary browse-preset-save-btn" onClick={saveCurrentAsPreset}>
                      Save
                    </button>
                  </div>
                  {presets.length === 0 && <p className="browse-preset-empty">No saved presets</p>}
                  {presets.map((p) => (
                    <div key={p.name} className="browse-preset-row">
                      <button type="button" className="browse-preset-load" onClick={() => loadPreset(p)}>
                        <strong>{p.name}</strong>
                        <span>{p.cancer}{p.gene ? ` / ${p.gene}` : ""}{p.funcClass ? ` / ${p.funcClass}` : ""}</span>
                      </button>
                      <button type="button" className="browse-preset-delete" onClick={() => deletePreset(p.name)}>&times;</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <label className="browse-field-inline">
            <span>Rows</span>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
      </form>

      {/* ---- Active Filter Pills ---- */}
      {activeFilters.length > 0 && (
        <div className="browse-active-filters">
          <span className="browse-filters-label">Active filters:</span>
          <span className="browse-filter-pill browse-filter-pill-fixed">{submitted.cancer}</span>
          {activeFilters.map((f) => (
            <button key={f.key} className="browse-filter-pill" onClick={() => removeFilter(f.key)} type="button">
              {f.label}: {f.value} &times;
            </button>
          ))}
        </div>
      )}

      {/* ---- Results header ---- */}
      <div className="table-meta">
        <span>{data ? `${formatNumber(data.totalElements)} matching variants` : "Select filters and click Search"}</span>
        <span>
          {submitted.cancer}
          {submitted.funcClass ? ` / ${submitted.funcClass}` : ""}
          {submitted.exonicFunc ? ` / ${submitted.exonicFunc}` : ""}
          {submitted.chr ? ` / ${submitted.chr}` : ""}
          {submitted.gene ? ` / ${submitted.gene}` : ""}
          {submitted.sample ? ` / ${submitted.sample}` : ""}
        </span>
      </div>

      {variantsQuery.isLoading && <p className="panel-note">Loading variants...</p>}
      {variantsQuery.isError && (
        <p className="panel-note">Variant browse is unavailable — the aggregate file for {submitted.cancer} may not exist yet.</p>
      )}

      {data && data.content.length > 0 && (
        <>
          <DataTable data={data.content} columns={columns} />
          <div className="pagination-bar">
            <button className="button-secondary" disabled={data.first} onClick={() => setPage((p) => Math.max(p - 1, 1))}>Previous</button>
            <span>Page {data.page} / {Math.max(data.totalPages, 1)}</span>
            <button className="button-secondary" disabled={data.last} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </>
      )}

      {data && data.content.length === 0 && (
        <section className="detail-card empty-card">
          <h3>No matching variants</h3>
          <p>Try adjusting the filters, or check if the aggregate multianno file for {submitted.cancer} has been generated.</p>
        </section>
      )}
    </div>
  );
}
