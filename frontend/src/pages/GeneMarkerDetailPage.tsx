import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getMafFilterOptions, getMafGeneDetail, getMafSampleSuggestions, queryMafGeneMutations } from "../api/client";
import { formatNumber } from "../utils/format";

const PAGE_SIZE = 25;

export function GeneMarkerDetailPage() {
  const { geneSymbol = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const source = normalizeSource(searchParams.get("source"));
  const sample = searchParams.get("sample") ?? "";
  const cancerTypes = searchParams.getAll("cancerType");
  const chromosomes = searchParams.getAll("chromosome");
  const variantClasses = searchParams.getAll("variantClass");
  const variantTypes = searchParams.getAll("variantType");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const isCfDNA = source === "cfDNA";
  const [sampleInput, setSampleInput] = useState(sample);
  const [selectedCancer, setSelectedCancer] = useState(cancerTypes[0] ?? "");
  const [selectedChromosome, setSelectedChromosome] = useState(chromosomes[0] ?? "");
  const [selectedClass, setSelectedClass] = useState(variantClasses[0] ?? "");
  const [selectedType, setSelectedType] = useState(variantTypes[0] ?? "");
  const deferredSampleInput = useDeferredValue(sampleInput.trim());

  useEffect(() => {
    setSampleInput(sample);
  }, [sample]);

  useEffect(() => {
    setSelectedCancer(cancerTypes[0] ?? "");
  }, [cancerTypes]);

  useEffect(() => {
    setSelectedChromosome(chromosomes[0] ?? "");
  }, [chromosomes]);

  useEffect(() => {
    setSelectedClass(variantClasses[0] ?? "");
  }, [variantClasses]);

  useEffect(() => {
    setSelectedType(variantTypes[0] ?? "");
  }, [variantTypes]);

  const filterQ = useQuery({
    queryKey: ["maf-filter-options", source],
    queryFn: () => getMafFilterOptions(source),
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData
  });

  const sampleSuggestionsQ = useQuery({
    queryKey: ["maf-sample-suggestions", source, deferredSampleInput],
    queryFn: () => getMafSampleSuggestions(source, deferredSampleInput, 10),
    enabled: deferredSampleInput.length >= 2,
    staleTime: 60_000,
    placeholderData: keepPreviousData
  });

  const summaryQ = useQuery({
    queryKey: ["maf-gene-detail", source, geneSymbol, sample, cancerTypes, chromosomes, variantClasses, variantTypes],
    queryFn: () =>
      getMafGeneDetail(geneSymbol, {
        source,
        sample: sample || undefined,
        cancerType: cancerTypes,
        chromosome: chromosomes,
        variantClass: variantClasses,
        variantType: variantTypes
      }),
    placeholderData: keepPreviousData
  });

  const dataQ = useQuery({
    queryKey: ["maf-gene-mutations", source, geneSymbol, sample, cancerTypes, chromosomes, variantClasses, variantTypes, page],
    queryFn: () =>
      queryMafGeneMutations(geneSymbol, {
        source,
        sample: sample || undefined,
        cancerType: cancerTypes,
        chromosome: chromosomes,
        variantClass: variantClasses,
        variantType: variantTypes,
        page,
        size: PAGE_SIZE
      }),
    placeholderData: keepPreviousData
  });

  const rows = dataQ.data?.content ?? [];
  const totalElements = dataQ.data?.totalElements ?? 0;
  const totalPages = dataQ.data?.totalPages ?? 1;
  const currentPage = Math.min(page, totalPages || 1);
  const startIndex = totalElements === 0 ? 0 : (currentPage - 1) * PAGE_SIZE;
  const summary = summaryQ.data;

  const buildBackLink = () => {
    const params = new URLSearchParams();
    params.set("source", source);
    params.set("gene", geneSymbol);
    if (sample) params.set("sample", sample);
    for (const value of cancerTypes) params.append("cancerType", value);
    for (const value of chromosomes) params.append("chromosome", value);
    for (const value of variantClasses) params.append("variantClass", value);
    for (const value of variantTypes) params.append("variantType", value);
    return `/gene-search?${params.toString()}`;
  };

  const activeTags = [
    { label: "Source", value: source },
    ...(sample ? [{ label: "Sample", value: sample }] : []),
    ...cancerTypes.map((value) => ({ label: "Cancer", value })),
    ...chromosomes.map((value) => ({ label: "Chr", value: formatChromosome(value) })),
    ...variantClasses.map((value) => ({ label: "Class", value })),
    ...variantTypes.map((value) => ({ label: "Type", value }))
  ];

  const goToPage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next);
  };

  const submitTableFilter = (event?: FormEvent) => {
    event?.preventDefault();
    const next = new URLSearchParams();
    next.set("source", source);
    if (sampleInput.trim()) next.set("sample", sampleInput.trim());
    if (selectedCancer) next.append("cancerType", selectedCancer);
    if (selectedChromosome) next.append("chromosome", selectedChromosome);
    if (selectedClass) next.append("variantClass", selectedClass);
    if (selectedType) next.append("variantType", selectedType);
    next.set("page", "1");
    setSearchParams(next);
  };

  const clearTableFilter = () => {
    const next = new URLSearchParams();
    next.set("source", source);
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
        </div>
        <div className="maf-detail-actions">
          <Link className="button-secondary" to={buildBackLink()}>Back to Gene Search</Link>
        </div>
      </section>

      <section className="maf-summary-strip" aria-label="Gene Summary">
        <SummaryCard label="Gene" value={summary.hugoSymbol} helper="Selected HUGO symbol" />
        <SummaryCard label="Variants" value={formatNumber(summary.totalVariants)} helper="Filtered mutation records" />
        <SummaryCard label="Samples" value={formatNumber(summary.totalSamples)} helper="Distinct Tumor_Sample_Barcode" />
        <SummaryCard label="Sites" value={formatNumber(summary.totalCoordinates)} helper="Distinct genomic coordinates" />
      </section>

      <section className="maf-active-panel">
        <div className="maf-active-header">
          <h3>Gene Overview</h3>
          <span>{source}</span>
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

        <form className="maf-detail-filterbar" onSubmit={submitTableFilter}>
          <label className="maf-detail-filter-field maf-detail-filter-grow maf-detail-filter-autocomplete">
            <span>Sample Barcode</span>
            <input
              value={sampleInput}
              onChange={(event) => setSampleInput(event.target.value)}
              placeholder="Filter by sample barcode"
            />
            {sampleInput.trim().length >= 2 && (sampleSuggestionsQ.isFetching || (sampleSuggestionsQ.data?.length ?? 0) > 0) ? (
              <div className="maf-autocomplete-dropdown">
                {sampleSuggestionsQ.isFetching ? <div className="maf-autocomplete-item muted">Loading...</div> : null}
                {!sampleSuggestionsQ.isFetching && (sampleSuggestionsQ.data ?? []).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="maf-autocomplete-item"
                    onClick={() => setSampleInput(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
          </label>

          {isCfDNA ? (
            <label className="maf-detail-filter-field">
              <span>Cancer</span>
              <select value={selectedCancer} onChange={(event) => setSelectedCancer(event.target.value)}>
                <option value="">All</option>
                {(filterQ.data?.cancerTypes ?? []).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="maf-detail-filter-field">
            <span>Chromosome</span>
            <select value={selectedChromosome} onChange={(event) => setSelectedChromosome(event.target.value)}>
              <option value="">All</option>
              {(filterQ.data?.chromosomes ?? []).map((option) => (
                <option key={option} value={option}>{formatChromosome(option)}</option>
              ))}
            </select>
          </label>

          <label className="maf-detail-filter-field">
            <span>Class</span>
            <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
              <option value="">All</option>
              {(filterQ.data?.variantClassifications ?? []).map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="maf-detail-filter-field">
            <span>Type</span>
            <select value={selectedType} onChange={(event) => setSelectedType(event.target.value)}>
              <option value="">All</option>
              {(filterQ.data?.variantTypes ?? []).map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <div className="maf-detail-filter-actions">
            <button className="button-primary" type="submit">Apply</button>
            <button className="button-secondary" type="button" onClick={clearTableFilter}>Reset</button>
          </div>
        </form>

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
  helper: string;
}) {
  return (
    <div className="maf-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{helper}</p>
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
