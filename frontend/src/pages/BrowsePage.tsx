import { useCallback, useMemo, useRef, useState } from "react";
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
import { formatCohortLabel } from "../utils/cohortLabels";

const MAX_ONCOPLOT_GENES = 30;
const DEFAULT_ONCOPLOT_LIMIT = 40;
const GENE_INPUT_EXAMPLES = [
  ["TTN", "MUC12", "OBSCN", "HRNR", "EPPK1"],
];

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
  const [geneInput, setGeneInput] = useState("");
  const [geneError, setGeneError] = useState<string | null>(null);
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
      return "Internal Data uses the internal cohort statistics plots and internal mutation rows for the interactive oncoplot.";
    }
    if (activeSource === "Public") {
      return "Public Cohorts uses aggregated statistics plots and mutation rows from external public datasets (e.g. GEO) for the interactive oncoplot.";
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
        description="Browse each cohort through oncoplots and maftools summary plots. This page is cohort-centric rather than sample-centric."
      />

      <section className="detail-card statistics-toolbar-card">
        <div className="statistics-toolbar-top">
          <label className="statistics-toolbar-field">
            <span>Cohort</span>
            <select value={cancer} onChange={(event) => setParam("cancer", event.target.value)}>
              {CANCER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {formatCohortLabel(option)}
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
          <div className="statistics-toolbar-field statistics-toolbar-field--genes">
            <span>Gene Input</span>
            <div className="statistics-gene-inline">
              <textarea
                ref={geneInputRef}
                className="statistics-gene-textarea"
                value={geneInput}
                onChange={(event) => {
                  onGeneInputChange(event.target.value);
                  syncGeneInputHeight(event.target);
                }}
                placeholder="Enter genes separated by commas, spaces, or new lines"
                rows={1}
              />
              <span className="statistics-gene-or">OR</span>
              <button type="button" className="statistics-gene-upload-btn" onClick={() => fileInputRef.current?.click()}>
                Upload file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv,.xlsx"
                className="statistics-gene-hidden-file"
                onChange={(event) => void onFileChange(event.target.files?.[0] ?? null)}
              />
            </div>
            <div className="statistics-gene-examples" aria-label="Gene input examples">
              <span className="statistics-gene-examples-label">Example:</span>
              <div className="statistics-gene-examples-list">
                {GENE_INPUT_EXAMPLES.map((example) => {
                  const text = example.join(", ");
                  return (
                    <button
                      key={text}
                      type="button"
                      className="statistics-gene-example-btn"
                      onClick={() => fillGeneExample(example)}
                      title="Click to fill"
                    >
                      {text}
                    </button>
                  );
                })}
              </div>
            </div>
            {geneError ? <p className="statistics-gene-error">{geneError}</p> : null}
          </div>
        </div>

        <div className="statistics-toolbar-meta">
          <strong>
            {formatCohortLabel(cancer)} {activeSource ? `| ${selectedLabel}` : ""}
          </strong>
          <p>{sourceSummary}</p>
        </div>
      </section>


      {activeSource ? (
        <article className="stat-pdf-card stat-pdf-card--oncoplot statistics-oncoplot-card">
          <div className="statistics-panel-header">
            <h3 className="stat-pdf-title">Oncoplot</h3>
            <p className="statistics-panel-note">
              {parsedGenes.length > 0
                ? `Selected genes in ${formatCohortLabel(cancer)} / ${selectedLabel} (up to ${MAX_ONCOPLOT_GENES}). Each column is a sample, each row is a gene, and cells are colored by the most severe mutation class observed.`
                : `Top ${DEFAULT_ONCOPLOT_LIMIT} most frequently mutated genes across all samples in ${formatCohortLabel(cancer)} / ${selectedLabel}. Each column is a sample, each row is a gene, and cells are colored by the most severe mutation class observed.`}
            </p>
          </div>
          {geneError ? <p className="panel-note" style={{ color: "#c0392b" }}>{geneError}</p> : null}
          {oncoplottQ.isLoading ? <p className="panel-note">Loading oncoplot data...</p> : null}
          {oncoplottQ.isError ? <p className="panel-note" style={{ color: "#c0392b" }}>Failed to load oncoplot data.</p> : null}
          {oncoplottQ.data && oncoplottQ.data.genes.length > 0 ? (
            <div className="statistics-pdf-shell statistics-pdf-shell--oncoplot">
              <WaterfallChart data={oncoplottQ.data} title={formatCohortLabel(cancer)} />
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
              {formatCohortLabel(cancer)} | {selectedLabel}
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
                No PDF files found for {formatCohortLabel(cancer)} / {selectedLabel}.
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
