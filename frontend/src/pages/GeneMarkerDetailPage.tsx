import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getMafGeneDetail, getMafSampleSuggestions, queryMafGeneMutations } from "../api/client";
import { IgvBrowser } from "../components/IgvBrowser";
import { formatNumber } from "../utils/format";

const PAGE_SIZE = 25;
const SOURCE_LABELS = {
  cfDNA: "cfDNA Liquid Biopsy",
  TCGA: "TCGA Solid Tumor",
} as const;

interface AppliedFilters {
  sample: string;
  cancerType: string[];
  chromosome: string[];
  variantClass: string[];
  variantType: string[];
}

export function GeneMarkerDetailPage() {
  const { geneSymbol = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const source = normalizeSource(searchParams.get("source"));
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const isCfDNA = source === "cfDNA";

  // Applied filters — what's actually sent to the backend. Initialized from URL params (deep-link support).
  const [applied, setApplied] = useState<AppliedFilters>(() => ({
    sample: searchParams.get("sample") ?? "",
    cancerType: searchParams.getAll("cancerType"),
    chromosome: searchParams.getAll("chromosome"),
    variantClass: searchParams.getAll("variantClass"),
    variantType: searchParams.getAll("variantType"),
  }));

  // Form state — what the user is currently editing (not yet applied)
  const [sampleInput, setSampleInput] = useState(applied.sample);
  const [selectedCancer, setSelectedCancer] = useState(applied.cancerType[0] ?? "");
  const [selectedChromosome, setSelectedChromosome] = useState(applied.chromosome[0] ?? "");
  const [selectedClass, setSelectedClass] = useState(applied.variantClass[0] ?? "");
  const [selectedType, setSelectedType] = useState(applied.variantType[0] ?? "");
  const deferredSampleInput = useDeferredValue(sampleInput.trim());
  const sampleAutocompleteRef = useRef<HTMLLabelElement>(null);
  const [showSampleSuggestions, setShowSampleSuggestions] = useState(false);
  const sourceLabel = SOURCE_LABELS[source];

  const sampleSuggestionsQ = useQuery({
    queryKey: ["maf-sample-suggestions", source, deferredSampleInput],
    queryFn: () => getMafSampleSuggestions(source, deferredSampleInput, 10),
    enabled: deferredSampleInput.length >= 2,
    staleTime: 60_000,
    placeholderData: keepPreviousData
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
    placeholderData: keepPreviousData
  });

  const dataQ = useQuery({
    queryKey: ["maf-gene-mutations", source, geneSymbol, applied, page],
    queryFn: () =>
      queryMafGeneMutations(geneSymbol, {
        source,
        sample: applied.sample || undefined,
        cancerType: applied.cancerType,
        chromosome: applied.chromosome,
        variantClass: applied.variantClass,
        variantType: applied.variantType,
        page,
        size: PAGE_SIZE
      }),
    placeholderData: keepPreviousData
  });

  // All mutations for IGV (cfDNA only) — always fetches unfiltered so option lists are complete
  const igvMutationsQ = useQuery({
    queryKey: ["igv-mutations", source, geneSymbol],
    queryFn: () =>
      queryMafGeneMutations(geneSymbol, {
        source,
        page: 1,
        size: 5000
      }),
    enabled: geneSymbol.length > 0,
    staleTime: 5 * 60_000
  });

  const rows = dataQ.data?.content ?? [];
  const totalElements = dataQ.data?.totalElements ?? 0;
  const totalPages = dataQ.data?.totalPages ?? 1;
  const currentPage = Math.min(page, totalPages || 1);
  const startIndex = totalElements === 0 ? 0 : (currentPage - 1) * PAGE_SIZE;
  const summary = summaryQ.data;

  // Derive filter option lists from the full unfiltered IGV mutation set
  const allIgvMutations = igvMutationsQ.data?.content ?? [];
  const derivedCancerTypes = [...new Set(allIgvMutations.map((m) => m.cancerType).filter(Boolean))].sort();
  const derivedChromosomes = [...new Set(allIgvMutations.map((m) => m.chromosome).filter(Boolean))].sort(
    (a, b) => {
      const n = (s: string) => parseInt(s.replace(/^chr/i, ""), 10);
      return isNaN(n(a)) || isNaN(n(b)) ? a.localeCompare(b) : n(a) - n(b);
    }
  );
  const derivedVariantClasses = [...new Set(allIgvMutations.map((m) => m.variantClassification).filter(Boolean))].sort();
  const derivedVariantTypes = [...new Set(allIgvMutations.map((m) => m.variantType).filter(Boolean))].sort();

  // Filter IGV mutations client-side to mirror the applied filters — memoized so IGV doesn't
  // re-initialize on every keystroke/select change (only reruns when applied or data actually changes)
  const igvMutations = useMemo(() => allIgvMutations.filter((m) => {
    if (applied.cancerType.length > 0 && !applied.cancerType.includes(m.cancerType)) return false;
    if (applied.chromosome.length > 0 && !applied.chromosome.includes(m.chromosome)) return false;
    if (applied.variantClass.length > 0 && !applied.variantClass.includes(m.variantClassification)) return false;
    if (applied.variantType.length > 0 && !applied.variantType.includes(m.variantType)) return false;
    return true;
  }), [allIgvMutations, applied]);

  const changeSource = (nextSource: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("source", nextSource === "TCGA" ? "TCGA" : "cfDNA");
    next.set("page", "1");
    setSearchParams(next);
    setApplied({ sample: "", cancerType: [], chromosome: [], variantClass: [], variantType: [] });
    setSampleInput("");
    setSelectedCancer("");
    setSelectedChromosome("");
    setSelectedClass("");
    setSelectedType("");
  };

  const buildBackLink = () => {
    const params = new URLSearchParams();
    params.set("source", source);
    params.set("gene", geneSymbol);
    if (applied.sample) params.set("sample", applied.sample);
    for (const v of applied.cancerType) params.append("cancerType", v);
    for (const v of applied.chromosome) params.append("chromosome", v);
    for (const v of applied.variantClass) params.append("variantClass", v);
    for (const v of applied.variantType) params.append("variantType", v);
    return `/gene-search?${params.toString()}`;
  };

  const activeTags = [
    ...(applied.sample ? [{ label: "Sample", value: applied.sample }] : []),
    ...applied.cancerType.map((v) => ({ label: "Cancer", value: v })),
    ...applied.chromosome.map((v) => ({ label: "Chr", value: formatChromosome(v) })),
    ...applied.variantClass.map((v) => ({ label: "Class", value: v })),
    ...applied.variantType.map((v) => ({ label: "Type", value: v })),
  ];

  const goToPage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next);
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
    // Reset to page 1 on filter change
    const next = new URLSearchParams(searchParams);
    next.set("page", "1");
    setSearchParams(next);
    next.set("page", "1");
    setSearchParams(next);
  };

  const clearTableFilter = () => {
    setApplied({ sample: "", cancerType: [], chromosome: [], variantClass: [], variantType: [] });
    setSampleInput("");
    setSelectedCancer("");
    setSelectedChromosome("");
    setSelectedClass("");
    setSelectedType("");
    const next = new URLSearchParams(searchParams);
    next.set("page", "1");
    setSearchParams(next);
  };

  if (summaryQ.isLoading) {
    return <p className="panel-note">Loading gene detail...</p>;
  }

  if (summaryQ.isError || !summary) {
    return (
      <section className="maf-results-panel">
        <h3>Gene detail unavailable</h3>
        <p className="panel-note">The selected gene could not be resolved in the current MAF view.</p>
        <Link className="button-secondary" to="/gene-search">Back to Gene Search</Link>
      </section>
    );
  }

  return (
    <div className="page-stack maf-page maf-detail-page">
      <section className="maf-hero maf-detail-header">
        <div className="maf-hero-copy">
          <span className="maf-eyebrow">Gene Detail</span>
          <h2>{geneSymbol}</h2>
          <p>
            Sample-level mutation records for the selected gene. This page expands the aggregated gene row into concrete
            barcodes, loci, alleles, classes, and annotations for the current filtered cohort view.
          </p>
          <div className="maf-source-switch" role="tablist" aria-label="Mutation source">
            {(["cfDNA", "TCGA"] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={`maf-source-pill${option === source ? " active" : ""}`}
                onClick={() => changeSource(option)}
              >
                {SOURCE_LABELS[option]}
              </button>
            ))}
          </div>
        </div>
        <div className="maf-detail-actions">
          <Link className="button-secondary" to={buildBackLink()}>Back to Gene Search</Link>
        </div>
      </section>

      <section className="maf-summary-strip" aria-label="Gene Summary">
        <SummaryCard label="Gene" value={summary.hugoSymbol} />
        <SummaryCard label="Variants" value={formatNumber(summary.totalVariants)} />
        <SummaryCard label="Samples" value={formatNumber(summary.totalSamples)} />
        <SummaryCard label="Sites" value={formatNumber(summary.totalCoordinates)} />
      </section>

      <section className="maf-active-panel">
        <div className="maf-active-header">
          <h3>Gene Overview</h3>
          <span>{sourceLabel}</span>
        </div>
        <div className="maf-active-tags">
          {activeTags.map((tag) => (
            <span key={`${tag.label}-${tag.value}`} className="maf-tag">
              <strong>{tag.label}:</strong> {tag.value}
            </span>
          ))}
        </div>
        <div className="maf-detail-grid">
          {isCfDNA ? (
            <InfoBlock label="Cancer Preview" value={summary.cancerTypesPreview} />
          ) : null}
          <InfoBlock label="Sample Preview" value={summary.sampleBarcodesPreview} mono />
          <InfoBlock label="Coordinate Preview" value={summary.coordinatePreview} mono />
          <InfoBlock label="Alleles Preview" value={summary.allelesPreview} mono />
          <InfoBlock label="Class Preview" value={summary.variantClassesPreview} />
          <InfoBlock label="Type Preview" value={summary.variantTypesPreview} />
          {isCfDNA ? <InfoBlock label="Annotation Preview" value={summary.annotationPreview} mono /> : null}
        </div>
      </section>

      <section className="maf-results-panel">
          <div className="maf-results-header">
            <div>
              <h3>Genome Browser</h3>
              <p>
                Interactive mutation map for <strong>{geneSymbol}</strong> on hg38.
                {applied.cancerType.length > 0 ? ` Filtered to ${applied.cancerType.join(", ")}.` : ""}
              </p>
            </div>
            <div className="maf-results-hint">
              {isCfDNA ? "Each track is a cancer cohort." : "Each track is a cancer type."} Hover mutations for details.
            </div>
          </div>

          <form className="maf-detail-filterbar" onSubmit={submitTableFilter}>
            <label className="maf-detail-filter-field maf-detail-filter-grow maf-detail-filter-autocomplete" ref={sampleAutocompleteRef}>
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
              {showSampleSuggestions && sampleInput.trim().length >= 2 && (sampleSuggestionsQ.isFetching || (sampleSuggestionsQ.data?.length ?? 0) > 0) ? (
                <div className="maf-autocomplete-dropdown">
                  {sampleSuggestionsQ.isFetching ? <div className="maf-autocomplete-item muted">Loading...</div> : null}
                  {!sampleSuggestionsQ.isFetching && (sampleSuggestionsQ.data ?? []).map((item) => (
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
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="maf-detail-filter-field">
              <span>Chromosome</span>
              <select value={selectedChromosome} onChange={(event) => setSelectedChromosome(event.target.value)}>
                <option value="">All</option>
                {derivedChromosomes.map((option) => (
                  <option key={option} value={option}>{formatChromosome(option)}</option>
                ))}
              </select>
            </label>

            <label className="maf-detail-filter-field">
              <span>Class</span>
              <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
                <option value="">All</option>
                {derivedVariantClasses.map((option) => (
                  <option key={option} value={option}>{option.replace(/_/g, " ")}</option>
                ))}
              </select>
            </label>

            <label className="maf-detail-filter-field">
              <span>Type</span>
              <select value={selectedType} onChange={(event) => setSelectedType(event.target.value)}>
                <option value="">All</option>
                {derivedVariantTypes.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <div className="maf-detail-filter-actions">
              <button className="button-primary" type="submit">Apply</button>
              <button className="button-secondary" type="button" onClick={clearTableFilter}>Reset</button>
            </div>
          </form>

          <IgvBrowser
            gene={geneSymbol}
            mutations={igvMutations}
            cancerTypes={applied.cancerType}
          />
      </section>

      <section className="maf-results-panel">
        <div className="maf-results-header">
          <div>
            <h3>Sample-level Mutation Records</h3>
            <p>
              Showing {totalElements === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + PAGE_SIZE, totalElements)} of{" "}
              {formatNumber(totalElements)} rows for {geneSymbol}
            </p>
          </div>
          <div className="maf-results-hint">
            This table is the detailed view behind the aggregated gene row.
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
              <p>Try broadening the filters or return to the gene summary table.</p>
            </div>
          ) : (
            <>
              <div className="maf-table-wrap">
                <table className="maf-table">
                  <thead>
                    <tr>
                      <th>Gene</th>
                      {isCfDNA ? <th>Cancer</th> : null}
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
                        {isCfDNA ? <td>{row.cancerType || "-"}</td> : null}
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
                <button className="button-secondary" type="button" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>
                  Previous
                </button>
                <span>Page {currentPage} / {totalPages}</span>
                <button className="button-secondary" type="button" disabled={currentPage >= totalPages} onClick={() => goToPage(currentPage + 1)}>
                  Next
                </button>
              </div>
            </>
          )
        ) : null}
      </section>

    </div>
  );
}

function normalizeSource(value: string | null) {
  return value === "TCGA" ? "TCGA" : "cfDNA";
}

function formatChromosome(value: string) {
  if (!value) return "-";
  return value.startsWith("chr") ? value : `chr${value}`;
}

function SummaryCard({
  label,
  value,
  helper
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="maf-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <p>{helper}</p> : null}
    </div>
  );
}

function InfoBlock({
  label,
  value,
  mono = false
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="maf-detail-block">
      <span>{label}</span>
      <div className={`maf-preview-value${mono ? " maf-mono-cell" : ""}`}>{value || "-"}</div>
    </div>
  );
}
