import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  getOncoplottData,
  getStatisticsPlots,
  toApiUrl,
} from "../api/client";
import { PdfPagePreview } from "../components/PdfPagePreview";
import { WaterfallChart } from "../components/WaterfallChart";
import { CANCER_OPTIONS, DEFAULT_CANCER } from "../constants/cfdna";
import type { CancerAsset } from "../types/api";
import { formatCohortLabel } from "../utils/cohortLabels";

const MAX_ONCOPLOT_GENES = 30;
const DEFAULT_ONCOPLOT_LIMIT = 40;
const GENE_INPUT_EXAMPLES = [
  ["TTN", "MUC12", "OBSCN", "HRNR", "EPPK1"],
];
const DISPLAY_PANELS = [
  { key: "mutation", label: "Mutation Plot" },
  { key: "summary", label: "Summary" },
  { key: "spectrum", label: "Spectrum" },
  { key: "titv", label: "Ti/Tv" },
] as const;

type DisplayPanelKey = typeof DISPLAY_PANELS[number]["key"];
type DisplayPanelState = Record<DisplayPanelKey, boolean>;

const DEFAULT_DISPLAY_PANELS: DisplayPanelState = {
  mutation: true,
  summary: true,
  spectrum: true,
  titv: true,
};

async function inflateRaw(data: Uint8Array) {
  const stream = new DecompressionStream("deflate-raw");
  const writer = stream.writable.getWriter();
  await writer.write(data);
  await writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

async function readZipEntries(arrayBuffer: ArrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const entries = new Map<string, Uint8Array>();
  let offset = 0;
  while (offset + 30 <= bytes.length) {
    const signature = bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
    if (signature !== 0x04034b50) break;
    const compression = bytes[offset + 8] | (bytes[offset + 9] << 8);
    const compressedSize = bytes[offset + 18] | (bytes[offset + 19] << 8) | (bytes[offset + 20] << 16) | (bytes[offset + 21] << 24);
    const fileNameLength = bytes[offset + 26] | (bytes[offset + 27] << 8);
    const extraFieldLength = bytes[offset + 28] | (bytes[offset + 29] << 8);
    const fileName = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + fileNameLength));
    const dataStart = offset + 30 + fileNameLength + extraFieldLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) break;
    const compressed = bytes.slice(dataStart, dataEnd);
    if (!fileName.endsWith("/")) {
      if (compression === 0) entries.set(fileName, compressed);
      if (compression === 8) entries.set(fileName, await inflateRaw(compressed));
    }
    offset = dataEnd;
  }
  return entries;
}

function decodeXmlText(bytes: Uint8Array) {
  return new TextDecoder("utf-8").decode(bytes);
}

async function parseXlsxToText(file: File) {
  const entries = await readZipEntries(await file.arrayBuffer());
  const workbookXml = entries.get("xl/workbook.xml");
  const relsXml = entries.get("xl/_rels/workbook.xml.rels");
  if (!workbookXml || !relsXml) return "";
  const parser = new DOMParser();
  const workbookDoc = parser.parseFromString(decodeXmlText(workbookXml), "application/xml");
  const relsDoc = parser.parseFromString(decodeXmlText(relsXml), "application/xml");
  const firstSheet = workbookDoc.getElementsByTagName("sheet")[0];
  if (!firstSheet) return "";
  const relId = firstSheet.getAttribute("r:id");
  const relationships = Array.from(relsDoc.getElementsByTagName("Relationship"));
  const rel = relationships.find((item) => item.getAttribute("Id") === relId);
  const target = rel?.getAttribute("Target");
  if (!target) return "";
  const worksheetPath = `xl/${target.replace(/^\/+/, "")}`;
  const worksheetXml = entries.get(worksheetPath);
  if (!worksheetXml) return "";
  const sharedStringsXml = entries.get("xl/sharedStrings.xml");
  const sharedStrings = sharedStringsXml
    ? Array.from(parser.parseFromString(decodeXmlText(sharedStringsXml), "application/xml").getElementsByTagName("t")).map((node) => node.textContent ?? "")
    : [];
  const sheetDoc = parser.parseFromString(decodeXmlText(worksheetXml), "application/xml");
  const values = Array.from(sheetDoc.getElementsByTagName("c")).map((cell) => {
    const type = cell.getAttribute("t");
    const raw = cell.getElementsByTagName("v")[0]?.textContent?.trim() ?? "";
    if (!raw) return "";
    if (type === "s") {
      const index = Number(raw);
      return Number.isInteger(index) ? (sharedStrings[index] ?? "") : "";
    }
    return raw;
  });
  return values.join("\n");
}

const BROWSE_SOURCES = [
  { source: "cfDNA", label: "Internal Data" },
  { source: "Public", label: "Public Cohorts" },
  { source: "tcga", label: "TCGA" },
] as const;

const SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  BROWSE_SOURCES.map((item) => [item.source, item.label])
);

function toBrowsePlotSource(source: string) {
  if (source === "cfDNA") return "private";
  if (source === "tcga") return "tcga";
  return "Public";
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

function escapeCsv(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function BrowsePlotCard({ asset, className = "" }: { asset: CancerAsset; className?: string }) {
  const plotKind = getPlotKind(asset);
  return (
    <article className={`stat-pdf-card stat-pdf-card--${plotKind}${className ? ` ${className}` : ""}`}>
      <div className="statistics-panel-header">
        <h3 className="stat-pdf-title">{asset.title}</h3>
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
  const [geneInput, setGeneInput] = useState("");
  const [geneError, setGeneError] = useState<string | null>(null);
  const [displayPanels, setDisplayPanels] = useState<DisplayPanelState>(DEFAULT_DISPLAY_PANELS);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const geneInputRef = useRef<HTMLTextAreaElement | null>(null);

  const parsedGenes = useMemo(() => {
    return Array.from(new Set(
      geneInput
        .split(/[\s,;\n\r\t]+/)
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean)
    ));
  }, [geneInput]);
  const effectiveGenes = useMemo(() => parsedGenes.slice(0, MAX_ONCOPLOT_GENES), [parsedGenes]);

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
    queryKey: ["browse-oncoplot", plotSource, cancer, effectiveGenes],
    queryFn: () => getOncoplottData(plotSource, [cancer], DEFAULT_ONCOPLOT_LIMIT, effectiveGenes.length > 0 ? effectiveGenes : undefined),
    enabled: !!plotSource && !!cancer && !geneError,
    staleTime: 5 * 60_000,
  });

  const onGeneInputChange = useCallback((value: string) => {
    setGeneInput(value);
    const count = Array.from(new Set(
      value
        .split(/[\s,;\n\r\t]+/)
        .map((token) => token.trim())
        .filter(Boolean)
    )).length;
    setGeneError(count > MAX_ONCOPLOT_GENES ? `Up to ${MAX_ONCOPLOT_GENES} genes are supported.` : null);
  }, []);

  const syncGeneInputHeight = useCallback((target: HTMLTextAreaElement) => {
    target.style.height = "44px";
    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
  }, []);

  const fillGeneExample = useCallback((example: string[]) => {
    const nextValue = example.join(", ");
    onGeneInputChange(nextValue);
    if (geneInputRef.current) {
      syncGeneInputHeight(geneInputRef.current);
      geneInputRef.current.focus();
    }
  }, [onGeneInputChange, syncGeneInputHeight]);

  const onFileChange = useCallback(async (file: File | null) => {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["txt", "csv", "xlsx"].includes(extension)) {
      setGeneError("Only txt, csv, and xlsx files are supported.");
      return;
    }
    try {
      let content = "";
      if (extension === "xlsx") {
        content = await parseXlsxToText(file);
      } else {
        content = await file.text();
      }
      onGeneInputChange(content);
      if (geneInputRef.current) {
        syncGeneInputHeight(geneInputRef.current);
      }
    } catch (_error) {
      setGeneError("Failed to parse the file. Please verify the file format.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [onGeneInputChange, syncGeneInputHeight]);

  const resetFilters = useCallback(() => {
    const params = new URLSearchParams();
    params.set("cancer", DEFAULT_CANCER);
    params.set("source", BROWSE_SOURCES[0].source);
    setSearchParams(params);
    onGeneInputChange("");
    setDisplayPanels(DEFAULT_DISPLAY_PANELS);
    if (geneInputRef.current) {
      geneInputRef.current.style.height = "44px";
    }
  }, [onGeneInputChange, setSearchParams]);

  const toggleDisplayPanel = useCallback((key: DisplayPanelKey) => {
    setDisplayPanels((previous) => ({ ...previous, [key]: !previous[key] }));
  }, []);

  const selectAllPanels = useCallback(() => {
    setDisplayPanels(DEFAULT_DISPLAY_PANELS);
  }, []);

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
  const visibleSummaryPlots = useMemo(
    () => orderedSummaryPlots.filter((asset) => {
      const kind = getPlotKind(asset);
      return kind === "summary" || kind === "spectrum" || kind === "titv"
        ? displayPanels[kind]
        : true;
    }),
    [displayPanels, orderedSummaryPlots]
  );
  const loadedPanelCount = (oncoplottQ.data && oncoplottQ.data.genes.length > 0 ? 1 : 0) + orderedSummaryPlots.length;
  const selectedPanelCount = DISPLAY_PANELS.filter((panel) => displayPanels[panel.key]).length;
  const refreshResults = useCallback(() => {
    void plotsQ.refetch();
    void oncoplottQ.refetch();
  }, [oncoplottQ, plotsQ]);
  const downloadResultsCsv = useCallback(() => {
    const rows = [
      ["Panel", "Type", "Cohort", "Data Source", "File", "Genes", "Samples"],
    ];

    if (displayPanels.mutation && oncoplottQ.data && oncoplottQ.data.genes.length > 0) {
      rows.push([
        "Mutation plot",
        "mutation",
        formatCohortLabel(cancer),
        selectedLabel,
        "generated",
        String(oncoplottQ.data.genes.length),
        String(oncoplottQ.data.samples.length),
      ]);
    }

    visibleSummaryPlots.forEach((asset) => {
      rows.push([
        asset.title,
        getPlotKind(asset),
        formatCohortLabel(cancer),
        selectedLabel,
        asset.fileName,
        "",
        "",
      ]);
    });

    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `browse-${cancer}-${activeSource}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [activeSource, cancer, displayPanels.mutation, oncoplottQ.data, selectedLabel, visibleSummaryPlots]);

  return (
    <div className="page-stack rnabrowse-page">
      <div className="rnabrowse-layout">
        <aside className="rnabrowse-sidebar">
          <div className="rnabrowse-sidebar-title">
            <h2>Filters</h2>
          </div>

          <textarea
            ref={geneInputRef}
            className="rnabrowse-global-search"
            value={geneInput}
            onChange={(event) => {
              onGeneInputChange(event.target.value);
              syncGeneInputHeight(event.target);
            }}
            placeholder="Global Search"
            rows={1}
          />

          <FilterSection title="Disease">
            <select value={cancer} onChange={(event) => setParam("cancer", event.target.value)}>
              {CANCER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {formatCohortLabel(option)}
                </option>
              ))}
            </select>
          </FilterSection>

          <FilterSection title="Data Source">
            <select value={activeSource} onChange={(event) => setParam("source", event.target.value)}>
              {BROWSE_SOURCES.map((item) => (
                <option key={item.source} value={item.source}>
                  {item.label}
                </option>
              ))}
            </select>
          </FilterSection>

          <FilterSection title="Gene Input">
            <div className="rnabrowse-example-list">
              {GENE_INPUT_EXAMPLES.map((example) => {
                const text = example.join(", ");
                return (
                  <button
                    key={text}
                    type="button"
                    className="rnabrowse-example-btn"
                    onClick={() => fillGeneExample(example)}
                    title="Click to fill"
                  >
                    {text}
                  </button>
                );
              })}
            </div>
            <button type="button" className="rnabrowse-light-btn" onClick={() => fileInputRef.current?.click()}>
              Upload file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv,.xlsx"
              className="statistics-gene-hidden-file"
              onChange={(event) => void onFileChange(event.target.files?.[0] ?? null)}
            />
            {geneError ? <p className="rnabrowse-error">{geneError}</p> : null}
          </FilterSection>

          <FilterSection title="Panel Type">
            <div className="rnabrowse-check-list">
              {DISPLAY_PANELS.map((panel) => (
                <label key={panel.key}>
                  <input
                    type="checkbox"
                    checked={displayPanels[panel.key]}
                    onChange={() => toggleDisplayPanel(panel.key)}
                  />
                  <span>{panel.label}</span>
                </label>
              ))}
            </div>
          </FilterSection>

          <div className="rnabrowse-sidebar-actions">
            <button className="rnabrowse-submit" type="button" onClick={refreshResults}>
              Submit
            </button>
            <button className="rnabrowse-reset" type="button" onClick={resetFilters}>
              Reset
            </button>
          </div>
        </aside>

        <main className="rnabrowse-main">
          <div className="rnabrowse-results-title">
            <span className="rnabrowse-collapse-icon" aria-hidden="true" />
            <h2>Results</h2>
          </div>

          <section className="rnabrowse-display-panel">
            <div className="rnabrowse-bluebar">
              <span className="rnabrowse-grid-icon" aria-hidden="true" />
              <strong>Display Panels</strong>
              <span className="rnabrowse-chevron" aria-hidden="true" />
            </div>
            <div className="rnabrowse-display-body">
              {DISPLAY_PANELS.map((panel) => (
                <label key={panel.key} className="rnabrowse-display-check">
                  <input
                    type="checkbox"
                    checked={displayPanels[panel.key]}
                    onChange={() => toggleDisplayPanel(panel.key)}
                  />
                  <span>{panel.label}</span>
                </label>
              ))}
              <div className="rnabrowse-display-actions">
                <button type="button" onClick={() => setDisplayPanels(DEFAULT_DISPLAY_PANELS)}>
                  Reset Panels
                </button>
                <button type="button" onClick={selectAllPanels}>
                  Select All Panels
                </button>
              </div>
            </div>
          </section>

          <p className="rnabrowse-total">
            TOTAL OF <strong>{loadedPanelCount}</strong> RESULT PANELS,
            <strong> {oncoplottQ.data?.samples.length ?? 0}</strong> SAMPLES,
            <strong> {oncoplottQ.data?.genes.length ?? 0}</strong> GENES,
            <strong> {selectedPanelCount}</strong> DISPLAYED PANEL TYPES.
          </p>

          <div className="rnabrowse-toolbar">
            <button type="button" className="rnabrowse-light-btn" onClick={downloadResultsCsv}>Download CSV</button>
            <button type="button" className="rnabrowse-light-btn" onClick={refreshResults}>
              Refresh
            </button>
            <span>Show</span>
            <select value={selectedPanelCount} onChange={() => undefined} aria-label="Displayed panel count">
              <option>{selectedPanelCount}</option>
            </select>
            <span>entries</span>
            <label>
              Search:
              <input
                value={geneInput}
                onChange={(event) => onGeneInputChange(event.target.value)}
                aria-label="Search genes"
              />
            </label>
          </div>

          {activeSource && displayPanels.mutation ? (
            <article className="stat-pdf-card stat-pdf-card--oncoplot statistics-oncoplot-card rnabrowse-result-card">
              <div className="statistics-panel-header statistics-panel-header--plot">
                <div>
                  <h3 className="stat-pdf-title">Mutation plot</h3>
                  <p className="statistics-panel-note">Click gene labels to open Gene Search.</p>
                </div>
                {oncoplottQ.data && oncoplottQ.data.genes.length > 0 ? (
                  <span className="statistics-plot-meta">
                    {oncoplottQ.data.genes.length} genes, n={oncoplottQ.data.samples.length} samples
                  </span>
                ) : null}
              </div>
              {geneError ? <p className="panel-note" style={{ color: "#c0392b" }}>{geneError}</p> : null}
              {oncoplottQ.isLoading ? <p className="panel-note">Loading oncoplot data...</p> : null}
              {oncoplottQ.isError ? <p className="panel-note" style={{ color: "#c0392b" }}>Failed to load oncoplot data.</p> : null}
              {oncoplottQ.data && oncoplottQ.data.genes.length > 0 ? (
                <div className="statistics-pdf-shell statistics-pdf-shell--oncoplot">
                  <WaterfallChart data={oncoplottQ.data} />
                </div>
              ) : oncoplottQ.data && !oncoplottQ.isLoading ? (
                <p className="panel-note">No mutation data available for this cohort / source.</p>
              ) : null}
            </article>
          ) : null}

          {activeSource ? (
            <section className="rnabrowse-summary-section">
              <div className="rnabrowse-section-head">
                <h3>Summary Plots</h3>
              </div>

              {plotsQ.isLoading ? <p className="panel-note">Loading plots...</p> : null}
              {visibleSummaryPlots.length > 0 ? (
                <div className="statistics-pdf-layout statistics-pdf-layout--browse">
                  <div className="statistics-pdf-stack">
                    {visibleSummaryPlots.map((asset) => (
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
                    No PDF files found for {formatCohortLabel(cancer)} / {selectedLabel}.
                  </p>
                </section>
              ) : null}
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rnabrowse-filter-section">
      <div className="rnabrowse-filter-title">
        <span>{title}</span>
        <span aria-hidden="true" />
      </div>
      <div className="rnabrowse-filter-body">{children}</div>
    </section>
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
