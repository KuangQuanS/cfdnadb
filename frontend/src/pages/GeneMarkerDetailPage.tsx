import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { getGeneNcbiSummary, getMafGeneDetail, getMafSampleSuggestions, queryMafGeneMutations } from "../api/client";
import type { MafMutation } from "../types/api";
import { IgvBrowser } from "../components/IgvBrowser";
import { formatCohortLabel } from "../utils/cohortLabels";
import { formatNumber } from "../utils/format";

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 5;

type SourceKey = "cfDNA" | "TCGA";

const SOURCE_LABELS: Record<SourceKey, string> = {
  cfDNA: "Internal Data All",
  TCGA: "TCGA",
};

interface AppliedFilters {
  sample: string;
  cancerType: string[];
  chromosome: string[];
  variantClass: string[];
  variantType: string[];
}

const EMPTY_FILTERS: AppliedFilters = {
  sample: "",
  cancerType: [],
  chromosome: [],
  variantClass: [],
  variantType: [],
};

function escapeCsvCell(value: unknown) {
  const raw = value == null ? "" : String(value);
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, "\"\"")}"` : raw;
}

function downloadMutationRowsCsv(rows: MafMutation[], geneSymbol: string, source: SourceKey) {
  const headers = [
    "Gene",
    "Transcript",
    "Cancer",
    "Sample Barcode",
    "Chromosome",
    "Start Position",
    "End Position",
    "Reference Allele",
    "Tumor Seq Allele",
    "Class",
    "Type",
    "Functional Region",
    "Exonic Function",
    "Exon",
    "AA Change",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.hugoSymbol,
        row.transcript,
        formatCohortLabel(row.cancerType),
        row.tumorSampleBarcode,
        formatChromosome(row.chromosome),
        row.startPosition,
        row.endPosition,
        row.referenceAllele,
        row.tumorSeqAllele2,
        row.variantClassification,
        row.variantType,
        row.functionalRegion,
        row.exonicFunction,
        row.exon,
        row.aaChange,
      ]
        .map(escapeCsvCell)
        .join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const safeGene = geneSymbol.replace(/[^\w.-]+/g, "_");
  const fileName = `mutation_records_${safeGene || "gene"}_${source.toLowerCase()}.csv`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function GeneMarkerDetailPage() {
  const { geneSymbol = "" } = useParams();

  return (
    <div className="page-stack maf-page maf-detail-page">
      <section className="maf-hero maf-detail-header">
        <div className="maf-hero-copy">
          <span className="maf-eyebrow">Gene Detail</span>
          <h2>{geneSymbol}</h2>
          <p>
            Sample-level mutation records for <strong>{geneSymbol}</strong> across Internal Data and TCGA sources.
          </p>
        </div>
        <div className="maf-detail-actions">
          <Link className="button-secondary inline-button gene-detail-primary-action" to={`/survival?gene=${encodeURIComponent(geneSymbol)}`}>
            <span className="gene-detail-action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="M7 15c3 0 3-6 6-6s3 4 6 4" />
              </svg>
            </span>
            <span className="gene-survival-cta-label">
              <span className="gene-survival-cta-title">Survival Analysis</span>
              <span className="gene-survival-cta-sub">Kaplan–Meier for {geneSymbol}</span>
            </span>
            <span className="gene-survival-cta-arrow" aria-hidden="true">→</span>
          </Link>
          <Link className="gene-survival-back gene-detail-secondary-action" to={`/gene-search?gene=${encodeURIComponent(geneSymbol)}`}>
            ← Back to Gene Search
          </Link>
        </div>
      </section>

      <GeneNcbiPanel geneSymbol={geneSymbol} />

      <SourceDetailPanel source="cfDNA" geneSymbol={geneSymbol} />
      <SourceDetailPanel source="TCGA" geneSymbol={geneSymbol} />
    </div>
  );
}

function GeneNcbiPanel({ geneSymbol }: { geneSymbol: string }) {
  const { data } = useQuery({
    queryKey: ["gene-ncbi-summary", geneSymbol],
    queryFn: () => getGeneNcbiSummary(geneSymbol),
    enabled: Boolean(geneSymbol),
    staleTime: 60 * 60_000,
    retry: 1,
  });

  if (!data) {
    return null;
  }

  return (
    <section className="gene-ncbi-panel" aria-label={`NCBI summary for ${data.symbol}`}>
      <div className="gene-ncbi-panel-head">
        <span className="gene-ncbi-panel-title">About {data.symbol}</span>
        <a className="gene-ncbi-panel-link" href={data.ncbiUrl} target="_blank" rel="noopener noreferrer">
          View full record on NCBI ↗
        </a>
      </div>
      <dl className="gene-ncbi-panel-meta">
        {data.name ? (
          <>
            <dt>Official full name</dt>
            <dd>{data.name}</dd>
          </>
        ) : null}
        {data.aliases.length > 0 ? (
          <>
            <dt>Also known as</dt>
            <dd>{data.aliases.join("; ")}</dd>
          </>
        ) : null}
      </dl>
      {data.summary ? <p className="gene-ncbi-panel-summary">{data.summary}</p> : null}
    </section>
  );
}

function SourceDetailPanel({ source, geneSymbol }: { source: SourceKey; geneSymbol: string }) {
  const isCfDNA = source !== "TCGA";
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [applied, setApplied] = useState<AppliedFilters>(EMPTY_FILTERS);

  const [sampleInput, setSampleInput] = useState("");
  const [selectedCancer, setSelectedCancer] = useState("");
  const [displayCancer, setDisplayCancer] = useState("");
  const [selectedChromosome, setSelectedChromosome] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const deferredSampleInput = useDeferredValue(sampleInput.trim());
  const sampleAutocompleteRef = useRef<HTMLLabelElement>(null);
  const [showSampleSuggestions, setShowSampleSuggestions] = useState(false);
  const [downloading, setDownloading] = useState<"all" | null>(null);

  const sampleSuggestionsQ = useQuery({
    queryKey: ["maf-sample-suggestions", source, deferredSampleInput],
    queryFn: () => getMafSampleSuggestions(source, deferredSampleInput, 10),
    enabled: deferredSampleInput.length >= 2,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (sampleAutocompleteRef.current && !sampleAutocompleteRef.current.contains(event.target as Node)) {
        setShowSampleSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    const nextCancer = applied.cancerType[0] ?? "";
    setDisplayCancer(nextCancer);
  }, [applied.cancerType]);

  const summaryQ = useQuery({
    queryKey: ["maf-gene-detail", source, geneSymbol, applied],
    queryFn: () =>
      getMafGeneDetail(geneSymbol, {
        source,
        sample: applied.sample || undefined,
        cancerType: applied.cancerType,
        chromosome: applied.chromosome,
        variantClass: applied.variantClass,
        variantType: applied.variantType,
      }),
    placeholderData: keepPreviousData,
    enabled: geneSymbol.length > 0,
  });

  const dataQ = useQuery({
    queryKey: ["maf-gene-mutations", source, geneSymbol, applied, page, pageSize],
    queryFn: () =>
      queryMafGeneMutations(geneSymbol, {
        source,
        sample: applied.sample || undefined,
        cancerType: applied.cancerType,
        chromosome: applied.chromosome,
        variantClass: applied.variantClass,
        variantType: applied.variantType,
        page,
        size: pageSize,
      }),
    placeholderData: keepPreviousData,
    enabled: geneSymbol.length > 0,
  });

  const igvMutationsQ = useQuery({
    queryKey: ["igv-mutations", source, geneSymbol],
    queryFn: () => queryMafGeneMutations(geneSymbol, { source, page: 1, size: 5000 }),
    enabled: geneSymbol.length > 0,
    staleTime: 5 * 60_000,
  });

  const rows = dataQ.data?.content ?? [];
  const totalElements = dataQ.data?.totalElements ?? 0;
  const totalPages = dataQ.data?.totalPages ?? 1;
  const currentPage = Math.min(page, totalPages || 1);
  const startIndex = totalElements === 0 ? 0 : (currentPage - 1) * pageSize;
  const summary = summaryQ.data;

  const allIgvMutations = useMemo(() => igvMutationsQ.data?.content ?? [], [igvMutationsQ.data]);

  const derivedCancerTypes = useMemo(
    () => [...new Set(allIgvMutations.map((m) => m.cancerType).filter(Boolean))].sort(),
    [allIgvMutations],
  );
  const derivedChromosomes = useMemo(
    () =>
      [...new Set(allIgvMutations.map((m) => m.chromosome).filter(Boolean))].sort((a, b) => {
        const n = (s: string) => parseInt(s.replace(/^chr/i, ""), 10);
        return isNaN(n(a)) || isNaN(n(b)) ? a.localeCompare(b) : n(a) - n(b);
      }),
    [allIgvMutations],
  );
  const derivedVariantClasses = useMemo(
    () => [...new Set(allIgvMutations.map((m) => m.variantClassification).filter(Boolean))].sort(),
    [allIgvMutations],
  );
  const derivedVariantTypes = useMemo(
    () => [...new Set(allIgvMutations.map((m) => m.variantType).filter(Boolean))].sort(),
    [allIgvMutations],
  );

  const igvMutations = useMemo(
    () =>
      allIgvMutations.filter((m) => {
        if (applied.cancerType.length > 0 && !applied.cancerType.includes(m.cancerType)) return false;
        if (applied.chromosome.length > 0 && !applied.chromosome.includes(m.chromosome)) return false;
        if (applied.variantClass.length > 0 && !applied.variantClass.includes(m.variantClassification)) return false;
        if (applied.variantType.length > 0 && !applied.variantType.includes(m.variantType)) return false;
        return true;
      }),
    [allIgvMutations, applied],
  );

  const goToPage = (nextPage: number) => setPage(Math.max(1, nextPage));
  const changePageSize = (nextSize: number) => {
    setPageSize(nextSize);
    setPage(1);
  };

  const submitTableFilter = (event?: FormEvent) => {
    event?.preventDefault();
    setApplied({
      sample: sampleInput.trim(),
      cancerType: selectedCancer ? [selectedCancer] : [],
      chromosome: selectedChromosome ? [selectedChromosome] : [],
      variantClass: selectedClass ? [selectedClass] : [],
      variantType: selectedType ? [selectedType] : [],
    });
    setPage(1);
  };

  const clearTableFilter = () => {
    setApplied(EMPTY_FILTERS);
    setSampleInput("");
    setSelectedCancer("");
    setDisplayCancer("");
    setSelectedChromosome("");
    setSelectedClass("");
    setSelectedType("");
    setPage(1);
  };

  const handleDisplayCancerChange = (nextCancer: string) => {
    setDisplayCancer(nextCancer);
    setSelectedCancer(nextCancer);
    setApplied((prev) => ({
      ...prev,
      cancerType: nextCancer ? [nextCancer] : [],
    }));
    setPage(1);
  };

  const baseMutationFilters = useMemo(
    () => ({
      source,
      sample: applied.sample || undefined,
      cancerType: applied.cancerType,
      chromosome: applied.chromosome,
      variantClass: applied.variantClass,
      variantType: applied.variantType,
    }),
    [applied, source],
  );

  const handleDownloadAllRows = async () => {
    if (totalElements === 0) return;
    setDownloading("all");
    try {
      const batchSize = 500;
      const total = Math.max(1, Math.ceil(totalElements / batchSize));
      const allRows: MafMutation[] = [];
      for (let current = 1; current <= total; current += 1) {
        const pageData = await queryMafGeneMutations(geneSymbol, {
          ...baseMutationFilters,
          page: current,
          size: batchSize,
        });
        allRows.push(...pageData.content);
      }
      downloadMutationRowsCsv(allRows, `${geneSymbol}_all`, source);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <section className="maf-source-block">
      <div className="maf-source-block-header">
        <h3>{SOURCE_LABELS[source]}</h3>
        {summary ? (
          <span className="maf-source-block-stats">
            {formatNumber(summary.totalVariants)} variants · {formatNumber(summary.totalSamples)} samples ·{" "}
            {formatNumber(summary.totalCoordinates)} sites
          </span>
        ) : null}
      </div>

      <form className="maf-detail-filterbar" onSubmit={submitTableFilter}>
        <label
          className="maf-detail-filter-field maf-detail-filter-grow maf-detail-filter-autocomplete"
          ref={sampleAutocompleteRef}
        >
          <span>Sample Barcode</span>
          <input
            value={sampleInput}
            onChange={(event) => {
              setSampleInput(event.target.value);
              setShowSampleSuggestions(true);
            }}
            onFocus={() => {
              if (sampleInput.trim().length >= 2) setShowSampleSuggestions(true);
            }}
            placeholder="Filter by sample barcode"
          />
          {showSampleSuggestions &&
          sampleInput.trim().length >= 2 &&
          (sampleSuggestionsQ.isFetching || (sampleSuggestionsQ.data?.length ?? 0) > 0) ? (
            <div className="maf-autocomplete-dropdown">
              {sampleSuggestionsQ.isFetching ? <div className="maf-autocomplete-item muted">Loading...</div> : null}
              {!sampleSuggestionsQ.isFetching &&
                (sampleSuggestionsQ.data ?? []).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="maf-autocomplete-item"
                    onClick={() => {
                      setSampleInput(item);
                      setShowSampleSuggestions(false);
                    }}
                  >
                    {item}
                  </button>
                ))}
            </div>
          ) : null}
        </label>

        <label className="maf-detail-filter-field">
          <span>Cancer</span>
          <select value={selectedCancer} onChange={(event) => setSelectedCancer(event.target.value)}>
            <option value="">All</option>
            {derivedCancerTypes.map((option) => (
              <option key={option} value={option}>
                {formatCohortLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="maf-detail-filter-field">
          <span>Chromosome</span>
          <select value={selectedChromosome} onChange={(event) => setSelectedChromosome(event.target.value)}>
            <option value="">All</option>
            {derivedChromosomes.map((option) => (
              <option key={option} value={option}>
                {formatChromosome(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="maf-detail-filter-field">
          <span>Class</span>
          <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
            <option value="">All</option>
            {derivedVariantClasses.map((option) => (
              <option key={option} value={option}>
                {option.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>

        <label className="maf-detail-filter-field">
          <span>Type</span>
          <select value={selectedType} onChange={(event) => setSelectedType(event.target.value)}>
            <option value="">All</option>
            {derivedVariantTypes.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="maf-detail-filter-actions">
          <button className="button-primary" type="submit">
            Apply
          </button>
          <button className="button-secondary" type="button" onClick={clearTableFilter}>
            Reset
          </button>
        </div>
      </form>

      <div className="maf-results-panel">
        <div className="maf-results-header">
          <div>
            <h3>Genome Browser</h3>
            <p>
              Interactive mutation map for <strong>{geneSymbol}</strong> on hg38.
              {applied.cancerType.length > 0 ? ` Filtered to ${applied.cancerType.map(formatCohortLabel).join(", ")}.` : ""}
            </p>
          </div>
          <div className="maf-results-hint">
            {isCfDNA ? "Each track is a cancer cohort." : "Each track is a cancer type."} Hover mutations for details.
          </div>
        </div>

        {igvMutationsQ.isLoading ? (
          <p className="panel-note">Loading mutation map...</p>
        ) : (
          <IgvBrowser gene={geneSymbol} mutations={igvMutations} cancerTypes={applied.cancerType} />
        )}
      </div>

      <div className="maf-results-panel">
        <div className="maf-results-header">
          <div>
            <h3>Sample-level Mutation Records</h3>
            <p>
              Showing {totalElements === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + pageSize, totalElements)} of{" "}
              {formatNumber(totalElements)} rows for {geneSymbol}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "end", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <label className="maf-page-size-field" style={{ minWidth: 180 }}>
              <span>Display cancer</span>
              <select value={displayCancer} onChange={(event) => handleDisplayCancerChange(event.target.value)} disabled={downloading != null}>
                <option value="">All cancers</option>
                {derivedCancerTypes.map((option) => (
                  <option key={option} value={option}>
                    {formatCohortLabel(option)}
                  </option>
                ))}
              </select>
            </label>
            <button className="button-secondary" type="button" disabled={totalElements === 0 || downloading != null} onClick={handleDownloadAllRows}>
              {downloading === "all" ? "Downloading..." : "Download All"}
            </button>
            <label className="maf-page-size-field">
              <span>Rows per page</span>
              <select value={pageSize} onChange={(event) => changePageSize(Number(event.target.value))}>
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {dataQ.isLoading ? <p className="panel-note">Loading mutation records...</p> : null}
        {dataQ.isError ? (
          <p className="panel-note" style={{ color: "#c0392b" }}>
            Failed to load mutation detail.
          </p>
        ) : null}

        {!dataQ.isLoading && !dataQ.isError ? (
          rows.length === 0 ? (
            <div className="browse-empty-state">
              <h4>No mutation rows found</h4>
              <p>No records for this gene in the {SOURCE_LABELS[source]} collection.</p>
            </div>
          ) : (
            <>
              <div className="maf-table-wrap">
                <table className="maf-table">
                  <thead>
                    <tr>
                      <th>Gene</th>
                      <th>Cancer</th>
                      <th>Sample Barcode</th>
                      <th>Coordinate</th>
                      <th>Alleles</th>
                      <th>Class</th>
                      <th>Type</th>
                      {isCfDNA ? <th>Annotation</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={`${row.id}-${row.hugoSymbol}-${row.startPosition}-${row.tumorSampleBarcode}`}>
                        <td>
                          <div className="maf-cell-title">{row.hugoSymbol}</div>
                          {row.transcript ? <div className="maf-cell-sub">{row.transcript}</div> : null}
                        </td>
                        <td>{formatCohortLabel(row.cancerType)}</td>
                        <td className="maf-mono-cell">{row.tumorSampleBarcode}</td>
                        <td className="maf-mono-cell">
                          {formatChromosome(row.chromosome)}:{row.startPosition}
                          {row.endPosition && row.endPosition !== row.startPosition ? `-${row.endPosition}` : ""}
                        </td>
                        <td className="maf-mono-cell">
                          {row.referenceAllele} &rarr; {row.tumorSeqAllele2}
                        </td>
                        <td>{row.variantClassification}</td>
                        <td>{row.variantType}</td>
                        {isCfDNA ? (
                          <td>
                            <div className="maf-annotation-block">
                              {row.functionalRegion ? <span>{row.functionalRegion}</span> : null}
                              {row.exonicFunction ? <span>{row.exonicFunction}</span> : null}
                              {row.exon ? <span>{row.exon}</span> : null}
                              {row.aaChange ? <span className="maf-mono-cell">{row.aaChange}</span> : null}
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pagination-bar">
                <button
                  className="button-secondary"
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => goToPage(currentPage - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {currentPage} / {totalPages || 1}
                </span>
                <button
                  className="button-secondary"
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                >
                  Next
                </button>
              </div>
            </>
          )
        ) : null}
      </div>
    </section>
  );
}

function formatChromosome(value: string) {
  if (!value) return "-";
  return value.startsWith("chr") ? value : `chr${value}`;
}
