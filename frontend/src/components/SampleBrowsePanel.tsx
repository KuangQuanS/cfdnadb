import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  downloadSampleFiles,
  getSampleBrowse,
  getSampleDetail,
  toApiUrl,
  type SampleBrowseFilters
} from "../api/client";
import { CANCER_OPTIONS, DEFAULT_CANCER } from "../constants/cfdna";
import type { LabelCount, SampleBrowseItem, SampleSelection } from "../types/api";
import { formatNumber } from "../utils/format";

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const PRESETS_KEY = "cfdnadb-browse-sample-presets";
const SOURCE_OPTIONS = [
  { value: "private", label: "cfDNA Private" },
  { value: "geo", label: "cfDNA GEO" },
] as const;
const DOWNLOAD_SOURCE_OPTIONS = [
  ...SOURCE_OPTIONS,
  { value: "healthy", label: "Healthy VCF" },
] as const;
const DOWNLOAD_CANCER_OPTIONS = [...CANCER_OPTIONS, "Healthy"] as const;
const COLUMN_OPTIONS = [
  { key: "sampleId", label: "Sample ID" },
  { key: "cancer", label: "Cohort" },
  { key: "source", label: "Source" },
  { key: "variantCount", label: "#Variants" },
  { key: "topGenes", label: "Top Genes" },
  { key: "files", label: "Files" }
] as const;

type ColumnKey = typeof COLUMN_OPTIONS[number]["key"];

interface BrowseDraft {
  cancers: string[];
  sources: string[];
  gene: string;
  sample: string;
  minVariants: string;
  hasAnnotated: boolean;
  hasSomatic: boolean;
}

interface BrowsePreset extends BrowseDraft {
  name: string;
}

interface SampleBrowsePanelProps {
  compact?: boolean;
  eyebrow?: string;
  title?: string;
  description?: string;
  mode?: "browse" | "downloads";
}

function defaultDraft(mode: "browse" | "downloads"): BrowseDraft {
  return {
    cancers: mode === "downloads" ? [DEFAULT_CANCER, "Healthy"] : [DEFAULT_CANCER],
    sources: mode === "downloads" ? ["private", "geo", "healthy"] : ["private", "geo"],
    gene: "",
    sample: "",
    minVariants: "",
    hasAnnotated: false,
    hasSomatic: false
  };
}

function loadPresets(): BrowsePreset[] {
  try {
    return JSON.parse(localStorage.getItem(PRESETS_KEY) ?? "[]") as BrowsePreset[];
  } catch {
    return [];
  }
}

function savePresets(presets: BrowsePreset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

function sampleKey(item: SampleSelection) {
  return `${item.cancer}::${item.source}::${item.sampleId}`;
}

function sourceLabel(source: string) {
  if (source === "private") return "Private cfDNA";
  if (source === "public") return "Public cfDNA";
  if (source === "tcga") return "TCGA";
  if (source === "healthy") return "Healthy VCF";
  return source;
}

function formatTimestamp(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function escapeCsvCell(value: string | number) {
  const text = String(value);
  if (!text.includes(",") && !text.includes("\"") && !text.includes("\n")) return text;
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function toggleValue(current: string[], value: string) {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

export function SampleBrowsePanel({
  compact = false,
  eyebrow = "Filtered Multianno Export",
  title = "Select samples, inspect summaries, and export annotated files",
  description = "Filter by cohort, source, mutation burden, or carrier gene, then select samples for file export.",
  mode = "browse"
}: SampleBrowsePanelProps) {
  const availableColumns = COLUMN_OPTIONS.filter((item) => mode !== "downloads" || item.key !== "topGenes");
  const [draft, setDraft] = useState<BrowseDraft>(() => defaultDraft(mode));
  const [submitted, setSubmitted] = useState<BrowseDraft>(() => defaultDraft(mode));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    new Set(availableColumns.map((item) => item.key))
  );
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presets, setPresets] = useState<BrowsePreset[]>(loadPresets);
  const [selectedRows, setSelectedRows] = useState<Record<string, SampleBrowseItem>>({});
  const [detailTarget, setDetailTarget] = useState<SampleSelection | null>(null);
  const [downloadingType, setDownloadingType] = useState<string | null>(null);
  const sourceOptions = mode === "downloads" ? DOWNLOAD_SOURCE_OPTIONS : SOURCE_OPTIONS;
  const showSomaticFilter = mode !== "downloads";
  const includeTopGenes = mode !== "downloads";
  const isDownloadsCompact = compact && mode === "downloads";

  const queryFilters = useMemo<SampleBrowseFilters>(() => ({
    cancers: submitted.cancers,
    sources: submitted.sources,
    gene: submitted.gene.trim() || undefined,
    sample: submitted.sample.trim() || undefined,
    minVariants: submitted.minVariants ? Number(submitted.minVariants) : undefined,
    hasAnnotated: submitted.hasAnnotated,
    hasSomatic: showSomaticFilter ? submitted.hasSomatic : false,
    includeTopGenes,
    page,
    size: pageSize
  }), [submitted, page, pageSize, showSomaticFilter, includeTopGenes]);

  const samplesQuery = useQuery({
    queryKey: ["browse-samples", queryFilters],
    queryFn: () => getSampleBrowse(queryFilters)
  });

  const detailQuery = useQuery({
    queryKey: ["browse-sample-detail", detailTarget?.cancer, detailTarget?.source, detailTarget?.sampleId],
    queryFn: () => getSampleDetail(detailTarget!.cancer, detailTarget!.source, detailTarget!.sampleId),
    enabled: detailTarget != null
  });

  const rows = samplesQuery.data?.content ?? [];
  const selectedItems = useMemo(() => Object.values(selectedRows), [selectedRows]);
  const selectedCount = selectedItems.length;
  const allCurrentSelected = rows.length > 0 && rows.every((item) => selectedRows[sampleKey(item)]);

  const totalVariantsOnPage = rows.reduce((sum, item) => sum + item.variantCount, 0);
  const totalVisibleFiles = rows.reduce((sum, item) => sum + item.availableFiles.length, 0);

  const activeTags = [
      ...submitted.cancers.map((cancer) => ({ key: `cancer:${cancer}`, label: "Cancer", value: cancer, rawValue: cancer })),
      ...submitted.sources.map((source) => ({ key: `source:${source}`, label: "Source", value: sourceLabel(source), rawValue: source })),
      ...(submitted.gene ? [{ key: "gene", label: "Gene", value: submitted.gene, rawValue: submitted.gene }] : []),
      ...(submitted.sample ? [{ key: "sample", label: "Sample", value: submitted.sample, rawValue: submitted.sample }] : []),
      ...(submitted.minVariants ? [{ key: "minVariants", label: "Min variants", value: submitted.minVariants, rawValue: submitted.minVariants }] : []),
      ...(submitted.hasAnnotated ? [{ key: "hasAnnotated", label: "Files", value: "Has anno", rawValue: "true" }] : []),
    ...(showSomaticFilter && submitted.hasSomatic ? [{ key: "hasSomatic", label: "Files", value: "Has somatic", rawValue: "true" }] : []),
  ];

  const applyFilters = () => {
    setPage(1);
    setSubmitted({
      ...draft,
      cancers: draft.cancers.length > 0 ? draft.cancers : [DEFAULT_CANCER],
      sources: draft.sources.length > 0 ? draft.sources : ["private", "geo"]
    });
  };

  const resetFilters = () => {
    const next = defaultDraft(mode);
    setDraft(next);
    setSubmitted(next);
    setPage(1);
  };

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const saveCurrentPreset = () => {
    if (!presetName.trim()) return;
    const nextPreset: BrowsePreset = { name: presetName.trim(), ...draft };
    const next = [...presets.filter((item) => item.name !== nextPreset.name), nextPreset];
    setPresets(next);
    savePresets(next);
    setPresetName("");
  };

  const loadPreset = (preset: BrowsePreset) => {
    setDraft(preset);
    setSubmitted(preset);
    setPage(1);
    setShowPresetMenu(false);
  };

  const deletePreset = (name: string) => {
    const next = presets.filter((item) => item.name !== name);
    setPresets(next);
    savePresets(next);
  };

  const toggleRow = (item: SampleBrowseItem) => {
    const key = sampleKey(item);
    setSelectedRows((previous) => {
      if (previous[key]) {
        const { [key]: _ignored, ...rest } = previous;
        return rest;
      }
      return { ...previous, [key]: item };
    });
  };

  const toggleCurrentPage = () => {
    setSelectedRows((previous) => {
      const next = { ...previous };
      if (allCurrentSelected) {
        rows.forEach((item) => {
          delete next[sampleKey(item)];
        });
      } else {
        rows.forEach((item) => {
          next[sampleKey(item)] = item;
        });
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedRows({});

  const exportSelectedCsv = () => {
    if (selectedItems.length === 0) return;
    const lines = [
      ["Sample ID", "Cohort", "Source", "#Variants", "Top Genes", "Files"].map(escapeCsvCell).join(","),
      ...selectedItems.map((item) => [
        item.sampleId,
        item.cancer,
        sourceLabel(item.source),
        item.variantCount,
        item.topGenes.join("; "),
        item.availableFiles.join("; ")
      ].map(escapeCsvCell).join(","))
    ];
    downloadBlob(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" }), "cfdnadb_selected_samples.csv");
  };

  const handleBatchDownload = async () => {
    if (selectedItems.length === 0) return;
    setDownloadingType("files");
    try {
      const result = await downloadSampleFiles("files", selectedItems);
      downloadBlob(result.blob, result.fileName);
    } finally {
      setDownloadingType(null);
    }
  };

  const removeTag = (key: string, value: string) => {
    if (key.startsWith("cancer:")) {
      setDraft((previous) => ({ ...previous, cancers: previous.cancers.filter((item) => item !== value) }));
      setSubmitted((previous) => ({ ...previous, cancers: previous.cancers.filter((item) => item !== value) }));
    } else if (key.startsWith("source:")) {
      setDraft((previous) => ({ ...previous, sources: previous.sources.filter((item) => item !== value) }));
      setSubmitted((previous) => ({ ...previous, sources: previous.sources.filter((item) => item !== value) }));
    } else if (key === "gene") {
      setDraft((previous) => ({ ...previous, gene: "" }));
      setSubmitted((previous) => ({ ...previous, gene: "" }));
    } else if (key === "sample") {
      setDraft((previous) => ({ ...previous, sample: "" }));
      setSubmitted((previous) => ({ ...previous, sample: "" }));
    } else if (key === "minVariants") {
      setDraft((previous) => ({ ...previous, minVariants: "" }));
      setSubmitted((previous) => ({ ...previous, minVariants: "" }));
    } else if (key === "hasAnnotated") {
      setDraft((previous) => ({ ...previous, hasAnnotated: false }));
      setSubmitted((previous) => ({ ...previous, hasAnnotated: false }));
    } else if (key === "hasSomatic") {
      setDraft((previous) => ({ ...previous, hasSomatic: false }));
      setSubmitted((previous) => ({ ...previous, hasSomatic: false }));
    }
  };

  const canDownloadFiles = selectedItems.some((item) => item.availableFiles.length > 0);
  const wrapperClass = compact ? "browse-samples-page browse-samples-page--compact" : "browse-samples-page";
  const filterSections = (
    <>
      <FilterSection title="Cancer Type">
        <div className="browse-samples-chip-grid">
          {(mode === "downloads" ? DOWNLOAD_CANCER_OPTIONS : CANCER_OPTIONS).map((cancer) => (
            <button
              key={cancer}
              type="button"
              className={`browse-samples-chip${draft.cancers.includes(cancer) ? " active" : ""}`}
              onClick={() => setDraft((previous) => ({ ...previous, cancers: toggleValue(previous.cancers, cancer) }))}
            >
              {cancer}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Data Source">
        <div className="browse-samples-chip-grid browse-samples-chip-grid-tight">
          {sourceOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`browse-samples-chip${draft.sources.includes(option.value) ? " active" : ""}`}
              onClick={() => setDraft((previous) => ({ ...previous, sources: toggleValue(previous.sources, option.value) }))}
            >
              {option.label}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Mutation Filters">
        <label className="browse-field">
          <span>Carrier Gene</span>
          <input
            value={draft.gene}
            onChange={(event) => setDraft((previous) => ({ ...previous, gene: event.target.value.toUpperCase() }))}
            placeholder="e.g. TP53"
          />
        </label>
        <label className="browse-field">
          <span>Minimum Variants</span>
          <input
            type="number"
            min={0}
            value={draft.minVariants}
            onChange={(event) => setDraft((previous) => ({ ...previous, minVariants: event.target.value }))}
            placeholder="0"
          />
        </label>
      </FilterSection>

      <FilterSection title="File Availability">
        <label className="browse-samples-check">
          <input
            type="checkbox"
            checked={draft.hasAnnotated}
            onChange={(event) => setDraft((previous) => ({ ...previous, hasAnnotated: event.target.checked }))}
          />
          <span>Has multianno file</span>
        </label>
        {showSomaticFilter ? (
          <label className="browse-samples-check">
            <input
              type="checkbox"
              checked={draft.hasSomatic}
              onChange={(event) => setDraft((previous) => ({ ...previous, hasSomatic: event.target.checked }))}
            />
            <span>Has somatic file</span>
          </label>
        ) : null}
      </FilterSection>
    </>
  );

  return (
    <div className={wrapperClass}>
      {compact ? (
        isDownloadsCompact ? (
          <section className="detail-card downloads-filtered-control-card">
            <div className="downloads-filtered-control-summary">
              <div className="downloads-filtered-control-metrics">
                <MetricTile label="Matching Samples" value={formatNumber(samplesQuery.data?.totalElements ?? 0)} />
                <MetricTile label="Page Variants" value={formatNumber(totalVariantsOnPage)} />
                <MetricTile label="Visible Files" value={formatNumber(totalVisibleFiles)} />
                <MetricTile label="Selected" value={formatNumber(selectedCount)} />
              </div>
            </div>

            <div className="downloads-filtered-control-bar">
              <div className="downloads-filtered-control-search">
                <label className="browse-field browse-samples-toolbar-search">
                  <span>Sample ID Search</span>
                  <input
                    value={draft.sample}
                    onChange={(event) => setDraft((previous) => ({ ...previous, sample: event.target.value }))}
                    placeholder="Filter sample barcode"
                    autoComplete="off"
                  />
                </label>
                <button className="button-primary" type="button" onClick={applyFilters}>Apply</button>
              </div>

              <div className="downloads-filtered-control-actions">
                <label className="browse-field-inline">
                  <span>Rows</span>
                  <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
                    {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </label>

                <div className="browse-dropdown-wrap">
                  <button className="button-secondary" type="button" onClick={() => { setShowColumnMenu((value) => !value); setShowPresetMenu(false); }}>
                    Columns
                  </button>
                  {showColumnMenu && (
                    <div className="browse-dropdown-menu">
                      {availableColumns.map((column) => (
                        <label key={column.key} className="browse-dropdown-item">
                          <input
                            type="checkbox"
                            checked={visibleColumns.has(column.key)}
                            onChange={() => toggleColumn(column.key)}
                          />
                          {column.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="browse-dropdown-wrap">
                  <button className="button-secondary" type="button" onClick={() => { setShowPresetMenu((value) => !value); setShowColumnMenu(false); }}>
                    Presets
                  </button>
                  {showPresetMenu && (
                    <div className="browse-dropdown-menu browse-preset-menu">
                      <div className="browse-preset-save">
                        <input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Preset name" />
                        <button className="button-primary browse-preset-save-btn" type="button" onClick={saveCurrentPreset}>Save</button>
                      </div>
                      {presets.length === 0 && <p className="browse-preset-empty">No saved presets</p>}
                      {presets.map((preset) => (
                        <div key={preset.name} className="browse-preset-row">
                          <button type="button" className="browse-preset-load" onClick={() => loadPreset(preset)}>
                            <strong>{preset.name}</strong>
                            <span>
                              {preset.cancers.join(", ")}
                              {preset.gene ? ` / ${preset.gene}` : ""}
                              {preset.minVariants ? ` / >= ${preset.minVariants}` : ""}
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
        ) : (
        <section className={`detail-card downloads-filtered-hero-card${mode === "downloads" ? " downloads-filtered-hero-card--downloads" : ""}`}>
          <section className="browse-samples-hero browse-samples-hero--embedded">
            <div className="browse-samples-hero-copy">
              <p className="section-eyebrow">{eyebrow}</p>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
            <div className="browse-samples-hero-metrics">
              <MetricTile label="Matching Samples" value={formatNumber(samplesQuery.data?.totalElements ?? 0)} />
              <MetricTile label="Page Variants" value={formatNumber(totalVariantsOnPage)} />
              <MetricTile label="Visible Files" value={formatNumber(totalVisibleFiles)} />
              <MetricTile label="Selected" value={formatNumber(selectedCount)} />
            </div>
          </section>

          <section className="browse-samples-toolbar browse-samples-toolbar--embedded">
            <div className="browse-samples-toolbar-main">
              <label className="browse-field browse-samples-toolbar-search">
                <span>Sample ID Search</span>
                <input
                  value={draft.sample}
                  onChange={(event) => setDraft((previous) => ({ ...previous, sample: event.target.value }))}
                  placeholder="Filter sample barcode"
                  autoComplete="off"
                />
              </label>
              <button className="button-primary" type="button" onClick={applyFilters}>Apply</button>
            </div>

            <div className="browse-samples-toolbar-actions">
              <label className="browse-field-inline">
                <span>Rows</span>
                <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
                  {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>

              <div className="browse-dropdown-wrap">
                <button className="button-secondary" type="button" onClick={() => { setShowColumnMenu((value) => !value); setShowPresetMenu(false); }}>
                  Columns
                </button>
                {showColumnMenu && (
                  <div className="browse-dropdown-menu">
                    {COLUMN_OPTIONS.map((column) => (
                      <label key={column.key} className="browse-dropdown-item">
                        <input
                          type="checkbox"
                          checked={visibleColumns.has(column.key)}
                          onChange={() => toggleColumn(column.key)}
                        />
                        {column.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="browse-dropdown-wrap">
                <button className="button-secondary" type="button" onClick={() => { setShowPresetMenu((value) => !value); setShowColumnMenu(false); }}>
                  Presets
                </button>
                {showPresetMenu && (
                  <div className="browse-dropdown-menu browse-preset-menu">
                    <div className="browse-preset-save">
                      <input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Preset name" />
                      <button className="button-primary browse-preset-save-btn" type="button" onClick={saveCurrentPreset}>Save</button>
                    </div>
                    {presets.length === 0 && <p className="browse-preset-empty">No saved presets</p>}
                    {presets.map((preset) => (
                      <div key={preset.name} className="browse-preset-row">
                        <button type="button" className="browse-preset-load" onClick={() => loadPreset(preset)}>
                          <strong>{preset.name}</strong>
                          <span>
                            {preset.cancers.join(", ")}
                            {preset.gene ? ` / ${preset.gene}` : ""}
                            {preset.minVariants ? ` / >= ${preset.minVariants}` : ""}
                          </span>
                        </button>
                        <button type="button" className="browse-preset-delete" onClick={() => deletePreset(preset.name)}>&times;</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </section>
        )
      ) : (
        <>
          <section className="detail-card browse-samples-hero">
            <div className="browse-samples-hero-copy">
              <p className="section-eyebrow">{eyebrow}</p>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
            <div className="browse-samples-hero-metrics">
              <MetricTile label="Matching Samples" value={formatNumber(samplesQuery.data?.totalElements ?? 0)} />
              <MetricTile label="Page Variants" value={formatNumber(totalVariantsOnPage)} />
              <MetricTile label="Visible Files" value={formatNumber(totalVisibleFiles)} />
              <MetricTile label="Selected" value={formatNumber(selectedCount)} />
            </div>
          </section>

          <section className="detail-card browse-samples-toolbar">
            <div className="browse-samples-toolbar-main">
              <label className="browse-field browse-samples-toolbar-search">
                <span>Sample ID Search</span>
                <input
                  value={draft.sample}
                  onChange={(event) => setDraft((previous) => ({ ...previous, sample: event.target.value }))}
                  placeholder="Filter sample barcode"
                  autoComplete="off"
                />
              </label>
              <button className="button-primary" type="button" onClick={applyFilters}>Apply</button>
            </div>

            <div className="browse-samples-toolbar-actions">
              <label className="browse-field-inline">
                <span>Rows</span>
                <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
                  {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>

              <div className="browse-dropdown-wrap">
                <button className="button-secondary" type="button" onClick={() => { setShowColumnMenu((value) => !value); setShowPresetMenu(false); }}>
                  Columns
                </button>
                {showColumnMenu && (
                  <div className="browse-dropdown-menu">
                    {COLUMN_OPTIONS.map((column) => (
                      <label key={column.key} className="browse-dropdown-item">
                        <input
                          type="checkbox"
                          checked={visibleColumns.has(column.key)}
                          onChange={() => toggleColumn(column.key)}
                        />
                        {column.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="browse-dropdown-wrap">
                <button className="button-secondary" type="button" onClick={() => { setShowPresetMenu((value) => !value); setShowColumnMenu(false); }}>
                  Presets
                </button>
                {showPresetMenu && (
                  <div className="browse-dropdown-menu browse-preset-menu">
                    <div className="browse-preset-save">
                      <input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Preset name" />
                      <button className="button-primary browse-preset-save-btn" type="button" onClick={saveCurrentPreset}>Save</button>
                    </div>
                    {presets.length === 0 && <p className="browse-preset-empty">No saved presets</p>}
                    {presets.map((preset) => (
                      <div key={preset.name} className="browse-preset-row">
                        <button type="button" className="browse-preset-load" onClick={() => loadPreset(preset)}>
                          <strong>{preset.name}</strong>
                          <span>
                            {preset.cancers.join(", ")}
                            {preset.gene ? ` / ${preset.gene}` : ""}
                            {preset.minVariants ? ` / >= ${preset.minVariants}` : ""}
                          </span>
                        </button>
                        <button type="button" className="browse-preset-delete" onClick={() => deletePreset(preset.name)}>&times;</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {!compact && activeTags.length > 0 && (
        <div className="browse-active-filters">
          <span className="browse-filters-label">Active filters</span>
          {activeTags.map((tag) => (
            <button key={tag.key} className="browse-filter-pill" type="button" onClick={() => removeTag(tag.key, tag.rawValue)}>
              {tag.label}: {tag.value} &times;
            </button>
          ))}
        </div>
      )}

      {compact ? (
        <section className={`detail-card downloads-filtered-workspace-card${mode === "downloads" ? " downloads-filtered-workspace-card--downloads" : ""}`}>
          {!isDownloadsCompact && activeTags.length > 0 ? (
            <div className="browse-active-filters browse-active-filters--embedded">
              <span className="browse-filters-label">Active filters</span>
              {activeTags.map((tag) => (
                <button key={tag.key} className="browse-filter-pill" type="button" onClick={() => removeTag(tag.key, tag.rawValue)}>
                  {tag.label}: {tag.value} &times;
                </button>
              ))}
            </div>
          ) : null}

          <div className={`downloads-filtered-workspace-grid${mode === "downloads" ? " downloads-filtered-workspace-grid--downloads" : ""}`}>
            <section className="browse-samples-top-filters browse-samples-top-filters--embedded">
              {isDownloadsCompact ? (
                <div className="downloads-filtered-sidebar-copy">
                  <p className="section-eyebrow">{eyebrow}</p>
                  <h3>{title}</h3>
                  <p className="browse-summary-line">{description}</p>
                  {activeTags.length > 0 && (
                    <div className="browse-active-filters browse-active-filters--embedded browse-active-filters--sidebar">
                      <span className="browse-filters-label">Active filters</span>
                      {activeTags.map((tag) => (
                        <button key={tag.key} className="browse-filter-pill" type="button" onClick={() => removeTag(tag.key, tag.rawValue)}>
                          {tag.label}: {tag.value} &times;
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
              <div className="browse-panel-header">
                <h3>Filters</h3>
                <p className="browse-summary-line">Define which samples enter the filtered file export.</p>
              </div>
              <div className="browse-samples-top-filter-grid">
                {filterSections}
              </div>
              <div className="browse-samples-sidebar-actions">
                <button className="button-primary" type="button" onClick={applyFilters}>Apply Filters</button>
                <button className="button-secondary" type="button" onClick={resetFilters}>Reset</button>
              </div>
            </section>

            <section className="browse-samples-main browse-samples-main--wide browse-samples-main--embedded">
              <div className="browse-results-header">
                <div>
                  <h3>Sample Table</h3>
                  <p className="browse-results-summary">
                    Each row is a sample summary. Click a row to open the drawer with mounted file details.
                  </p>
                </div>
              </div>

              {selectedCount > 0 && (
                <div className="browse-samples-selection-bar">
                  <div>
                    <strong>{formatNumber(selectedCount)}</strong> samples selected
                  </div>
                  <div className="browse-samples-selection-actions">
                    <button className="button-secondary" type="button" onClick={clearSelection}>Clear</button>
                    <button className="button-secondary" type="button" onClick={exportSelectedCsv}>Export CSV</button>
                    <button
                      className="button-secondary"
                      type="button"
                      disabled={!canDownloadFiles || downloadingType != null}
                      onClick={handleBatchDownload}
                    >
                      {downloadingType === "files" ? "Downloading..." : "Download selected files"}
                    </button>
                  </div>
                </div>
              )}

              {samplesQuery.isLoading && <p className="panel-note">Loading sample summaries...</p>}
              {samplesQuery.isError && (
                <div className="browse-empty-state">
                  <h4>Sample browse is unavailable</h4>
                  <p>The sample summary API did not return data for the current filters.</p>
                </div>
              )}

              {!samplesQuery.isLoading && !samplesQuery.isError && rows.length === 0 && (
                <div className="browse-empty-state">
                  <h4>No matching samples</h4>
                  <p>Try relaxing the carrier gene, variant threshold, or file availability filters.</p>
                </div>
              )}

              {rows.length > 0 && (
                <>
                  <div className="browse-samples-table-shell">
                    <table className="data-table browse-samples-table">
                      <thead>
                        <tr>
                          <th>
                            <input type="checkbox" checked={allCurrentSelected} onChange={toggleCurrentPage} />
                          </th>
                          {visibleColumns.has("sampleId") && <th>Sample ID</th>}
                          {visibleColumns.has("cancer") && <th>Cohort</th>}
                          {visibleColumns.has("source") && <th>Source</th>}
                          {visibleColumns.has("variantCount") && <th>#Variants</th>}
                          {visibleColumns.has("topGenes") && <th>Top Genes</th>}
                          {visibleColumns.has("files") && <th>Files</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((item) => {
                          const key = sampleKey(item);
                          const checked = Boolean(selectedRows[key]);
                          return (
                            <tr key={key} className="browse-samples-row" onClick={() => setDetailTarget(item)}>
                              <td onClick={(event) => event.stopPropagation()}>
                                <input type="checkbox" checked={checked} onChange={() => toggleRow(item)} />
                              </td>
                              {visibleColumns.has("sampleId") && (
                                <td>
                                  <div className="browse-samples-primary">{item.sampleId}</div>
                                </td>
                              )}
                              {visibleColumns.has("cancer") && <td>{item.cancer}</td>}
                              {visibleColumns.has("source") && <td><SourceBadge source={item.source} /></td>}
                              {visibleColumns.has("variantCount") && <td>{formatNumber(item.variantCount)}</td>}
                              {visibleColumns.has("topGenes") && (
                                <td>
                                  <div className="browse-samples-chip-list">
                                    {item.topGenes.length > 0 ? item.topGenes.map((gene) => (
                                      <span key={gene} className="browse-samples-mini-chip">{gene}</span>
                                    )) : <span className="browse-empty-copy">No gene summary</span>}
                                  </div>
                                </td>
                              )}
                              {visibleColumns.has("files") && (
                                <td>
                                  <div className="browse-samples-chip-list">
                                    {item.availableFiles.length > 0 ? item.availableFiles.map((file) => (
                                      <span key={file} className="browse-samples-file-chip">{file}</span>
                                    )) : <span className="browse-empty-copy">No mounted files</span>}
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="pagination-bar">
                    <button className="button-secondary" type="button" disabled={samplesQuery.data?.first} onClick={() => setPage((previous) => Math.max(previous - 1, 1))}>
                      Previous
                    </button>
                    <span>
                      Page {samplesQuery.data?.page ?? 1} / {Math.max(samplesQuery.data?.totalPages ?? 1, 1)}
                    </span>
                    <button className="button-secondary" type="button" disabled={samplesQuery.data?.last} onClick={() => setPage((previous) => previous + 1)}>
                      Next
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        </section>
      ) : (
        <div className="browse-samples-layout">
          <aside className="detail-card browse-samples-sidebar">
            <div className="browse-panel-header">
              <h3>Filters</h3>
              <p className="browse-summary-line">Define which samples enter the filtered file export.</p>
            </div>
            {filterSections}
            <div className="browse-samples-sidebar-actions">
              <button className="button-primary" type="button" onClick={applyFilters}>Apply Filters</button>
              <button className="button-secondary" type="button" onClick={resetFilters}>Reset</button>
            </div>
          </aside>

          <section className="detail-card browse-samples-main">
          <div className="browse-results-header">
            <div>
              <h3>Sample Table</h3>
              <p className="browse-results-summary">
                Each row is a sample summary. Click a row to open the drawer with file details and top mutated genes.
              </p>
            </div>
          </div>

          {selectedCount > 0 && (
            <div className="browse-samples-selection-bar">
              <div>
                <strong>{formatNumber(selectedCount)}</strong> samples selected
              </div>
              <div className="browse-samples-selection-actions">
                <button className="button-secondary" type="button" onClick={clearSelection}>Clear</button>
                <button className="button-secondary" type="button" onClick={exportSelectedCsv}>Export CSV</button>
                <button
                  className="button-secondary"
                  type="button"
                  disabled={!canDownloadFiles || downloadingType != null}
                  onClick={handleBatchDownload}
                >
                  {downloadingType === "files" ? "Downloading..." : "Download selected files"}
                </button>
              </div>
            </div>
          )}

          {samplesQuery.isLoading && <p className="panel-note">Loading sample summaries...</p>}
          {samplesQuery.isError && (
            <div className="browse-empty-state">
              <h4>Sample browse is unavailable</h4>
              <p>The sample summary API did not return data for the current filters.</p>
            </div>
          )}

          {!samplesQuery.isLoading && !samplesQuery.isError && rows.length === 0 && (
            <div className="browse-empty-state">
              <h4>No matching samples</h4>
              <p>Try relaxing the carrier gene, variant threshold, or file availability filters.</p>
            </div>
          )}

          {rows.length > 0 && (
            <>
              <div className="browse-samples-table-shell">
                <table className="data-table browse-samples-table">
                  <thead>
                    <tr>
                      <th>
                        <input type="checkbox" checked={allCurrentSelected} onChange={toggleCurrentPage} />
                      </th>
                      {visibleColumns.has("sampleId") && <th>Sample ID</th>}
                      {visibleColumns.has("cancer") && <th>Cohort</th>}
                      {visibleColumns.has("source") && <th>Source</th>}
                      {visibleColumns.has("variantCount") && <th>#Variants</th>}
                      {visibleColumns.has("topGenes") && <th>Top Genes</th>}
                      {visibleColumns.has("files") && <th>Files</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((item) => {
                      const key = sampleKey(item);
                      const checked = Boolean(selectedRows[key]);
                      return (
                        <tr key={key} className="browse-samples-row" onClick={() => setDetailTarget(item)}>
                          <td onClick={(event) => event.stopPropagation()}>
                            <input type="checkbox" checked={checked} onChange={() => toggleRow(item)} />
                          </td>
                          {visibleColumns.has("sampleId") && (
                            <td>
                              <div className="browse-samples-primary">{item.sampleId}</div>
                            </td>
                          )}
                          {visibleColumns.has("cancer") && <td>{item.cancer}</td>}
                          {visibleColumns.has("source") && <td><SourceBadge source={item.source} /></td>}
                          {visibleColumns.has("variantCount") && <td>{formatNumber(item.variantCount)}</td>}
                          {visibleColumns.has("topGenes") && (
                            <td>
                              <div className="browse-samples-chip-list">
                                {item.topGenes.length > 0 ? item.topGenes.map((gene) => (
                                  <span key={gene} className="browse-samples-mini-chip">{gene}</span>
                                )) : <span className="browse-empty-copy">No gene summary</span>}
                              </div>
                            </td>
                          )}
                          {visibleColumns.has("files") && (
                            <td>
                              <div className="browse-samples-chip-list">
                                {item.availableFiles.length > 0 ? item.availableFiles.map((file) => (
                                  <span key={file} className="browse-samples-file-chip">{file}</span>
                                )) : <span className="browse-empty-copy">No mounted files</span>}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pagination-bar">
                <button className="button-secondary" type="button" disabled={samplesQuery.data?.first} onClick={() => setPage((previous) => Math.max(previous - 1, 1))}>
                  Previous
                </button>
                <span>
                  Page {samplesQuery.data?.page ?? 1} / {Math.max(samplesQuery.data?.totalPages ?? 1, 1)}
                </span>
                <button className="button-secondary" type="button" disabled={samplesQuery.data?.last} onClick={() => setPage((previous) => previous + 1)}>
                  Next
                </button>
              </div>
            </>
          )}
          </section>
        </div>
      )}

      {detailTarget && (
        <div className="browse-sample-drawer-overlay" onClick={() => setDetailTarget(null)}>
          <aside className="browse-sample-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="browse-sample-drawer-header">
              <div>
                <p className="section-eyebrow">Sample Drawer</p>
                <h3>{detailTarget.sampleId}</h3>
                <p className="browse-summary-line">
                  {detailTarget.cancer} / {sourceLabel(detailTarget.source)}
                </p>
              </div>
              <button type="button" className="browse-files-close" onClick={() => setDetailTarget(null)}>&times;</button>
            </div>

            {detailQuery.isLoading && <p className="panel-note">Loading sample detail...</p>}
            {detailQuery.isError && (
              <div className="browse-empty-state">
                <h4>Detail unavailable</h4>
                <p>The sample drawer could not load the current sample summary.</p>
              </div>
            )}

            {detailQuery.data && (
              <div className="browse-sample-drawer-body">
                <div className="browse-sample-summary-grid">
                  <MetricTile label="Variants" value={formatNumber(detailQuery.data.variantCount)} />
                  <MetricTile label="Gene Hits" value={formatNumber(detailQuery.data.topGenes.length)} />
                  <MetricTile label="Files" value={formatNumber(detailQuery.data.files.length)} />
                </div>

                <div className="browse-sample-section">
                  <strong>Top Mutated Genes</strong>
                  {detailQuery.data.topGenes.length > 0 ? (
                    <div className="browse-sample-gene-list">
                      {detailQuery.data.topGenes.map((gene: LabelCount) => (
                        <div key={gene.label} className="browse-sample-gene-row">
                          <span>{gene.label}</span>
                          <strong>{formatNumber(gene.count)}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="browse-empty-copy">No mutation summary is available for this sample.</p>
                  )}
                </div>

                <div className="browse-sample-section">
                  <strong>Mounted Files</strong>
                  {detailQuery.data.files.length > 0 ? (
                    <div className="browse-sample-file-table-wrap">
                      <table className="data-table browse-sample-file-table">
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>File</th>
                            <th>Size</th>
                            <th>Modified</th>
                            <th>Download</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailQuery.data.files.map((file) => (
                            <tr key={`${file.type}-${file.fileName}`}>
                              <td>{file.type}</td>
                              <td className="browse-mono">{file.fileName}</td>
                              <td>{formatNumber(file.sizeBytes)}</td>
                              <td>{formatTimestamp(file.lastModified)}</td>
                              <td>
                                {file.downloadUrl ? (
                                  <a className="button-secondary browse-download-btn" href={toApiUrl(file.downloadUrl)} download>
                                    Download
                                  </a>
                                ) : (
                                  <span className="browse-empty-copy">Generated on demand</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="browse-empty-copy">No per-sample files are mounted for this source.</p>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="browse-samples-metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="browse-samples-filter-section">
      <div className="browse-panel-heading">
        <h3>{title}</h3>
      </div>
      <div className="browse-samples-filter-body">{children}</div>
    </section>
  );
}

function SourceBadge({ source }: { source: string }) {
  return (
    <span className={`browse-source-badge browse-source-${source.toLowerCase()}`}>
      {sourceLabel(source)}
    </span>
  );
}
