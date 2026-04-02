import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getMafFilterOptions,
  getMafGeneSuggestions,
  getMafSampleSuggestions,
  getMafSummary,
  queryMafMutations
} from "../api/client";
import { useSearchParams } from "react-router-dom";
import { formatNumber } from "../utils/format";

const PAGE_SIZE = 25;
const SOURCE_OPTIONS = ["cfDNA", "TCGA"] as const;

const SOURCE_COPY: Record<(typeof SOURCE_OPTIONS)[number], { title: string; description: string; note: string }> = {
  cfDNA: {
    title: "cfDNA MAF Workbench",
    description: "Search plasma-derived mutation calls with cohort-level labels and transcript-aware annotation.",
    note: "cfDNA supports Cancer Type plus transcript, exon, amino-acid change, and functional annotation."
  },
  TCGA: {
    title: "TCGA MAF Workbench",
    description: "Browse the TCGA mutation matrix using the same query surface, with the core MAF columns only.",
    note: "TCGA does not include Cancer Type or transcript annotation in the current file."
  }
};

export function GeneSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const source = normalizeSource(searchParams.get("source"));
  const gene = searchParams.get("gene") ?? "";
  const sample = searchParams.get("sample") ?? "";
  const cancerTypes = searchParams.getAll("cancerType");
  const chromosomes = searchParams.getAll("chromosome");
  const variantClasses = searchParams.getAll("variantClass");
  const variantTypes = searchParams.getAll("variantType");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const [geneInput, setGeneInput] = useState(gene);
  const [sampleInput, setSampleInput] = useState(sample);

  useEffect(() => {
    setGeneInput(gene);
  }, [gene]);

  useEffect(() => {
    setSampleInput(sample);
  }, [sample]);

  const deferredGeneInput = useDeferredValue(geneInput.trim());
  const deferredSampleInput = useDeferredValue(sampleInput.trim());
  const isCfDNA = source === "cfDNA";
  const sourceCopy = SOURCE_COPY[source];

  const filterQ = useQuery({
    queryKey: ["maf-filter-options", source],
    queryFn: () => getMafFilterOptions(source),
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData
  });

  const summaryQ = useQuery({
    queryKey: ["maf-summary", source, gene, sample, cancerTypes, chromosomes, variantClasses, variantTypes],
    queryFn: () =>
      getMafSummary({
        source,
        gene: gene || undefined,
        sample: sample || undefined,
        cancerType: cancerTypes,
        chromosome: chromosomes,
        variantClass: variantClasses,
        variantType: variantTypes
      }),
    placeholderData: keepPreviousData
  });

  const dataQ = useQuery({
    queryKey: ["maf-mutations", source, gene, sample, cancerTypes, chromosomes, variantClasses, variantTypes, page],
    queryFn: () =>
      queryMafMutations({
        source,
        gene: gene || undefined,
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

  const geneSuggestionsQ = useQuery({
    queryKey: ["maf-gene-suggestions", source, deferredGeneInput],
    queryFn: () => getMafGeneSuggestions(source, deferredGeneInput, 10),
    enabled: deferredGeneInput.length >= 2,
    staleTime: 60_000,
    placeholderData: keepPreviousData
  });

  const sampleSuggestionsQ = useQuery({
    queryKey: ["maf-sample-suggestions", source, deferredSampleInput],
    queryFn: () => getMafSampleSuggestions(source, deferredSampleInput, 10),
    enabled: deferredSampleInput.length >= 2,
    staleTime: 60_000,
    placeholderData: keepPreviousData
  });

  const rows = dataQ.data?.content ?? [];
  const totalElements = dataQ.data?.totalElements ?? 0;
  const totalPages = dataQ.data?.totalPages ?? 1;
  const currentPage = Math.min(page, totalPages || 1);
  const startIndex = totalElements === 0 ? 0 : (currentPage - 1) * PAGE_SIZE;
  const summary = summaryQ.data;

  const activeFilters = useMemo(
    () => [
      ...cancerTypes.map((value) => ({ label: "Cancer", value })),
      ...chromosomes.map((value) => ({ label: "Chr", value: formatChromosome(value) })),
      ...variantClasses.map((value) => ({ label: "Class", value })),
      ...variantTypes.map((value) => ({ label: "Type", value }))
    ],
    [cancerTypes, chromosomes, variantClasses, variantTypes]
  );

  const pagePreview = useMemo(() => {
    const sampleCount = new Set(rows.map((row) => row.tumorSampleBarcode).filter(Boolean)).size;
    const geneCount = new Set(rows.map((row) => row.hugoSymbol).filter(Boolean)).size;
    return { sampleCount, geneCount };
  }, [rows]);

  const mutateSearchParams = (mutator: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams();
    next.set("source", source);
    if (gene) next.set("gene", gene);
    if (sample) next.set("sample", sample);
    for (const value of cancerTypes) next.append("cancerType", value);
    for (const value of chromosomes) next.append("chromosome", value);
    for (const value of variantClasses) next.append("variantClass", value);
    for (const value of variantTypes) next.append("variantType", value);
    next.set("page", "1");
    mutator(next);
    setSearchParams(next);
  };

  const submitSearch = (event?: FormEvent) => {
    event?.preventDefault();
    const nextGene = geneInput.trim();
    const nextSample = sampleInput.trim();
    mutateSearchParams((params) => {
      if (nextGene) params.set("gene", nextGene);
      else params.delete("gene");

      if (nextSample) params.set("sample", nextSample);
      else params.delete("sample");
    });
  };

  const changeSource = (nextSource: (typeof SOURCE_OPTIONS)[number]) => {
    const next = new URLSearchParams();
    next.set("source", nextSource);
    if (geneInput.trim()) next.set("gene", geneInput.trim());
    if (sampleInput.trim()) next.set("sample", sampleInput.trim());
    next.set("page", "1");
    setSearchParams(next);
  };

  const clearFilters = () => {
    const next = new URLSearchParams();
    next.set("source", source);
    if (geneInput.trim()) next.set("gene", geneInput.trim());
    if (sampleInput.trim()) next.set("sample", sampleInput.trim());
    next.set("page", "1");
    setSearchParams(next);
  };

  const toggleMultiValue = (key: "cancerType" | "chromosome" | "variantClass" | "variantType", value: string) => {
    mutateSearchParams((params) => {
      const current = params.getAll(key);
      params.delete(key);
      const nextValues = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
      for (const item of nextValues) {
        params.append(key, item);
      }
    });
  };

  const goToPage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next);
  };

  return (
    <div className="page-stack maf-page">
      <section className="maf-hero">
        <div className="maf-hero-copy">
          <span className="maf-eyebrow">Mutation Workbench</span>
          <h2>{sourceCopy.title}</h2>
          <p>{sourceCopy.description}</p>
        </div>

        <div className="maf-source-switch" role="tablist" aria-label="Mutation source">
          {SOURCE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={`maf-source-pill${option === source ? " active" : ""}`}
              onClick={() => changeSource(option)}
            >
              {option}
            </button>
          ))}
        </div>

        <form className="maf-toolbar" onSubmit={submitSearch}>
          <AutocompleteField
            label="Gene Symbol"
            value={geneInput}
            placeholder="TP53, KRAS, PIK3CA..."
            suggestions={geneSuggestionsQ.data ?? []}
            loading={geneSuggestionsQ.isFetching}
            onChange={setGeneInput}
            onSelect={setGeneInput}
          />
          <AutocompleteField
            label="Sample Barcode"
            value={sampleInput}
            placeholder={source === "cfDNA" ? "BR_RTCG0P0003-1-TWN1" : "TCGA-E7-A519-01A"}
            suggestions={sampleSuggestionsQ.data ?? []}
            loading={sampleSuggestionsQ.isFetching}
            onChange={setSampleInput}
            onSelect={setSampleInput}
          />
          <div className="maf-toolbar-actions">
            <button className="button-primary" type="submit">Search</button>
            <button className="button-secondary" type="button" onClick={clearFilters}>Clear Filters</button>
          </div>
        </form>

        <div className="maf-filter-board">
          {isCfDNA ? (
            <MultiSelectGroup
              title="Cancer Type"
              values={cancerTypes}
              options={filterQ.data?.cancerTypes ?? []}
              loading={filterQ.isLoading}
              onToggle={(value) => toggleMultiValue("cancerType", value)}
            />
          ) : null}

          <MultiSelectGroup
            title="Chromosome"
            values={chromosomes}
            options={filterQ.data?.chromosomes ?? []}
            loading={filterQ.isLoading}
            formatLabel={formatChromosome}
            onToggle={(value) => toggleMultiValue("chromosome", value)}
          />

          <MultiSelectGroup
            title="Variant Classification"
            values={variantClasses}
            options={filterQ.data?.variantClassifications ?? []}
            loading={filterQ.isLoading}
            onToggle={(value) => toggleMultiValue("variantClass", value)}
          />

          <MultiSelectGroup
            title="Variant Type"
            values={variantTypes}
            options={filterQ.data?.variantTypes ?? []}
            loading={filterQ.isLoading}
            onToggle={(value) => toggleMultiValue("variantType", value)}
          />
        </div>

        <div className="maf-hero-note">{sourceCopy.note}</div>
      </section>

      <section className="maf-summary-strip" aria-label="Summary">
        <SummaryCard
          label="Matched Variants"
          value={summaryQ.isLoading ? "..." : formatNumber(summary?.totalVariants ?? 0)}
          helper="Current filtered result size"
        />
        <SummaryCard
          label="Matched Samples"
          value={summaryQ.isLoading ? "..." : formatNumber(summary?.totalSamples ?? 0)}
          helper="Distinct Tumor_Sample_Barcode"
        />
        <SummaryCard
          label="Matched Genes"
          value={summaryQ.isLoading ? "..." : formatNumber(summary?.totalGenes ?? 0)}
          helper="Distinct Hugo_Symbol"
        />
        <SummaryCard
          label={isCfDNA ? "Cancer Cohorts" : "Variant Classes"}
          value={
            isCfDNA
              ? formatNumber(filterQ.data?.cancerTypes.length ?? 0)
              : formatNumber(filterQ.data?.variantClassifications.length ?? 0)
          }
          helper="Available in current source"
        />
      </section>

      <section className="maf-active-panel">
        <div className="maf-active-header">
          <h3>Current Query</h3>
          <span>{source}</span>
        </div>
        <div className="maf-active-tags">
          {gene ? <span className="maf-tag"><strong>Gene:</strong> {gene}</span> : null}
          {sample ? <span className="maf-tag"><strong>Sample:</strong> {sample}</span> : null}
          {activeFilters.length === 0 && !gene && !sample ? <span className="maf-tag">No active filters</span> : null}
          {activeFilters.map((filter) => (
            <span key={`${filter.label}-${filter.value}`} className="maf-tag">
              <strong>{filter.label}:</strong> {filter.value}
            </span>
          ))}
        </div>
        {rows.length > 0 ? (
          <p className="maf-preview-text">
            Current page preview: {formatNumber(pagePreview.geneCount)} genes, {formatNumber(pagePreview.sampleCount)} samples.
          </p>
        ) : null}
      </section>

      <section className="maf-results-panel">
        <div className="maf-results-header">
          <div>
            <h3>Mutation Table</h3>
            <p>
              Showing {totalElements === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + PAGE_SIZE, totalElements)} of{" "}
              {formatNumber(totalElements)} rows
            </p>
          </div>
          <div className="maf-results-hint">
            {isCfDNA ? "cfDNA table includes transcript-level annotation." : "TCGA table shows the shared MAF core columns."}
          </div>
        </div>

        {dataQ.isLoading ? <p className="panel-note">Loading mutations...</p> : null}
        {dataQ.isError ? (
          <p className="panel-note" style={{ color: "#c0392b" }}>
            Failed to load mutation data.
          </p>
        ) : null}

        {!dataQ.isLoading && !dataQ.isError ? (
          rows.length === 0 ? (
            <div className="browse-empty-state">
              <h4>No mutations found</h4>
              <p>Try broadening the query or removing one of the active filters.</p>
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
                      <tr key={`${row.id}-${row.hugoSymbol}-${row.startPosition}`}>
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

function normalizeSource(value: string | null): (typeof SOURCE_OPTIONS)[number] {
  return value === "TCGA" ? "TCGA" : "cfDNA";
}

function formatChromosome(value: string) {
  if (!value) return "-";
  return value.startsWith("chr") ? value : `chr${value}`;
}

function AutocompleteField({
  label,
  value,
  placeholder,
  suggestions,
  loading,
  onChange,
  onSelect
}: {
  label: string;
  value: string;
  placeholder: string;
  suggestions: string[];
  loading: boolean;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
}) {
  const showDropdown = value.trim().length >= 2 && (loading || suggestions.length > 0);

  return (
    <label className="maf-autocomplete">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      {showDropdown ? (
        <div className="maf-autocomplete-dropdown">
          {loading ? <div className="maf-autocomplete-item muted">Loading...</div> : null}
          {!loading && suggestions.map((item) => (
            <button
              key={item}
              type="button"
              className="maf-autocomplete-item"
              onClick={() => onSelect(item)}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
}

function MultiSelectGroup({
  title,
  values,
  options,
  loading,
  onToggle,
  formatLabel = (value: string) => value
}: {
  title: string;
  values: string[];
  options: string[];
  loading: boolean;
  onToggle: (value: string) => void;
  formatLabel?: (value: string) => string;
}) {
  return (
    <div className="maf-filter-group-top">
      <div className="maf-filter-title">{title}</div>
      <div className="maf-filter-list">
        {loading ? <span className="maf-filter-loading">Loading...</span> : null}
        {!loading && options.map((option) => (
          <button
            key={option}
            type="button"
            className={`maf-filter-pill${values.includes(option) ? " active" : ""}`}
            onClick={() => onToggle(option)}
          >
            {formatLabel(option)}
          </button>
        ))}
      </div>
    </div>
  );
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
