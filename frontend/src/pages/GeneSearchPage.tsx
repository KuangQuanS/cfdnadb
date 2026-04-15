import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getMafFilterOptions,
  getMafGeneSuggestions,
  getMafSummary,
  queryMafGenes
} from "../api/client";
import { Link, useSearchParams } from "react-router-dom";
import { formatNumber } from "../utils/format";

const PAGE_SIZE = 25;
const SOURCE_OPTIONS = ["cfDNA", "TCGA"] as const;

const SOURCE_COPY: Record<(typeof SOURCE_OPTIONS)[number], { title: string; description: string }> = {
  cfDNA: {
    title: "cfDNA Liquid Biopsy Workbench",
    description: "Search plasma-derived mutation calls in a gene-centric table and expand into sample-level mutation detail only when needed."
  },
  TCGA: {
    title: "TCGA Solid Tumor Workbench",
    description: "Browse TCGA mutations with the same gene-centric surface, then open any gene to inspect its sample-level mutation records."
  }
};
const SOURCE_LABELS: Record<(typeof SOURCE_OPTIONS)[number], string> = {
  cfDNA: "cfDNA Liquid Biopsy",
  TCGA: "TCGA Solid Tumor",
};

const HARDCODED_CHROMOSOMES = ["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","X","Y"];

export function GeneSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const source = normalizeSource(searchParams.get("source"));
  const gene = searchParams.get("gene") ?? "";
  const cancerTypes = searchParams.getAll("cancerType");
  const chromosomes = searchParams.getAll("chromosome");
  const variantClasses = searchParams.getAll("variantClass");
  const variantTypes = searchParams.getAll("variantType");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const [geneInput, setGeneInput] = useState(gene);

  useEffect(() => {
    setGeneInput(gene);
  }, [gene]);

  const deferredGeneInput = useDeferredValue(geneInput.trim());
  const isCfDNA = source === "cfDNA";
  const sourceCopy = SOURCE_COPY[source];

  const filterQ = useQuery({
    queryKey: ["maf-filter-options", source],
    queryFn: () => getMafFilterOptions(source),
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData
  });

  const summaryQ = useQuery({
    queryKey: ["maf-summary", source, gene, cancerTypes, chromosomes, variantClasses, variantTypes],
    queryFn: () =>
      getMafSummary({
        source,
        gene: gene || undefined,
        cancerType: cancerTypes,
        chromosome: chromosomes,
        variantClass: variantClasses,
        variantType: variantTypes
      }),
    placeholderData: keepPreviousData
  });

  const dataQ = useQuery({
    queryKey: ["maf-genes", source, gene, cancerTypes, chromosomes, variantClasses, variantTypes, page],
    queryFn: () =>
      queryMafGenes({
        source,
        gene: gene || undefined,
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

  const pagePreview = useMemo(
    () => ({
      geneCount: rows.length,
      variantCount: rows.reduce((sum, row) => sum + row.totalVariants, 0)
    }),
    [rows]
  );

  const mutateSearchParams = (mutator: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams();
    next.set("source", source);
    if (gene) next.set("gene", gene);
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
    mutateSearchParams((params) => {
      if (nextGene) params.set("gene", nextGene);
      else params.delete("gene");
    });
  };

  const clearFilters = () => {
    const next = new URLSearchParams();
    next.set("source", source);
    if (geneInput.trim()) next.set("gene", geneInput.trim());
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

  const buildDetailLink = (geneSymbol: string) => {
    const params = new URLSearchParams();
    params.set("source", source);
    for (const value of cancerTypes) params.append("cancerType", value);
    for (const value of chromosomes) params.append("chromosome", value);
    for (const value of variantClasses) params.append("variantClass", value);
    for (const value of variantTypes) params.append("variantType", value);
    return `/gene-search/${encodeURIComponent(geneSymbol)}?${params.toString()}`;
  };

  return (
    <div className="page-stack maf-page">
      <section className="maf-hero">
        <div className="maf-hero-copy">
          <span className="maf-eyebrow">Mutation Workbench</span>
          <h2>{sourceCopy.title}</h2>
          <p>{sourceCopy.description}</p>
        </div>

        <div className="detail-card maf-search-card">
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
              options={HARDCODED_CHROMOSOMES}
              loading={false}
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
        </div>
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
          helper="One row per gene below"
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
          <span>{SOURCE_LABELS[source]}</span>
        </div>
        <div className="maf-active-tags">
          {gene ? <span className="maf-tag"><strong>Gene:</strong> {gene}</span> : null}
          {activeFilters.length === 0 && !gene ? <span className="maf-tag">No active filters</span> : null}
          {activeFilters.map((filter) => (
            <span key={`${filter.label}-${filter.value}`} className="maf-tag">
              <strong>{filter.label}:</strong> {filter.value}
            </span>
          ))}
        </div>
        {rows.length > 0 ? (
          <p className="maf-preview-text">
            Current page preview: {formatNumber(pagePreview.geneCount)} genes covering {formatNumber(pagePreview.variantCount)} filtered variants on this page.
          </p>
        ) : null}
      </section>

      <section className="maf-results-panel">
        <div className="maf-results-header">
          <div>
            <h3>Gene Summary Table</h3>
            <p>
              Showing {totalElements === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + PAGE_SIZE, totalElements)} of{" "}
              {formatNumber(totalElements)} genes
            </p>
          </div>
          <div className="maf-results-hint">
            Click any gene to open its sample-level mutation detail page.
            {isCfDNA ? (
              <span className="maf-results-hint-tip">
                {cancerTypes.length === 1
                  ? `Lollipop plots will be filtered to ${cancerTypes[0]}.`
                  : "Detail pages include lollipop plots across all cohorts."}
              </span>
            ) : null}
          </div>
        </div>

        {dataQ.isLoading ? <p className="panel-note">Loading gene summaries...</p> : null}
        {dataQ.isError ? (
          <p className="panel-note" style={{ color: "#c0392b" }}>
            Failed to load gene summaries.
          </p>
        ) : null}

        {!dataQ.isLoading && !dataQ.isError ? (
          rows.length === 0 ? (
            <div className="browse-empty-state">
              <h4>No genes found</h4>
              <p>Try broadening the query or removing one of the active filters.</p>
            </div>
          ) : (
            <>
              <div className="maf-table-wrap">
                <table className={`maf-table maf-gene-table${isCfDNA ? " maf-gene-table--cfdna" : " maf-gene-table--tcga"}`}>
                  <colgroup>
                    <col className="maf-gene-col maf-gene-col--gene" />
                    {isCfDNA ? <col className="maf-gene-col maf-gene-col--cancer" /> : null}
                    <col className="maf-gene-col maf-gene-col--sample" />
                    <col className="maf-gene-col maf-gene-col--coordinate" />
                    <col className="maf-gene-col maf-gene-col--alleles" />
                    <col className="maf-gene-col maf-gene-col--class" />
                    <col className="maf-gene-col maf-gene-col--type" />
                    {isCfDNA ? <col className="maf-gene-col maf-gene-col--annotation" /> : null}
                  </colgroup>
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
                      <tr key={`${row.hugoSymbol}-${row.totalVariants}`}>
                        <td>
                          <div className="maf-cell-title">
                            <Link className="maf-gene-link" to={buildDetailLink(row.hugoSymbol)}>
                              {row.hugoSymbol}
                            </Link>
                          </div>
                          <div className="maf-cell-sub">
                            {formatNumber(row.totalVariants)} variants · {formatNumber(row.totalSamples)} samples · {formatNumber(row.totalCoordinates)} sites
                          </div>
                        </td>
                        {isCfDNA ? (
                          <td>
                            <PreviewValue value={row.cancerTypesPreview} variant="chips" />
                          </td>
                        ) : null}
                        <td>
                          <PreviewValue value={row.sampleBarcodesPreview} mono variant="plain" />
                        </td>
                        <td>
                          <PreviewValue value={row.coordinatePreview} mono variant="plain" />
                        </td>
                        <td>
                          <PreviewValue value={row.allelesPreview} mono variant="plain" />
                        </td>
                        <td>
                          <PreviewValue value={row.variantClassesPreview} variant="chips" />
                        </td>
                        <td>
                          <PreviewValue value={row.variantTypesPreview} variant="chips" />
                        </td>
                        {isCfDNA ? (
                          <td>
                            <PreviewValue value={row.annotationPreview} variant="annotation" />
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
  const [isOpen, setIsOpen] = useState(false);
  const showDropdown = value.trim().length >= 2 && (loading || suggestions.length > 0);

  return (
    <label className="maf-autocomplete">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (value.trim().length >= 2) setIsOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        placeholder={placeholder}
      />
      {isOpen && showDropdown ? (
        <div className="maf-autocomplete-dropdown">
          {loading ? <div className="maf-autocomplete-item muted">Loading...</div> : null}
          {!loading && suggestions.map((item) => (
            <button
              key={item}
              type="button"
              className="maf-autocomplete-item"
              onMouseDown={() => {
                onSelect(item);
                setIsOpen(false);
              }}
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

function splitPreviewEntries(value: string) {
  if (!value || value.trim() === "-") return [];
  return Array.from(
    new Set(
      value
        .split(/\s*,\s*/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function looksLikeNotation(value: string) {
  return /(^[A-Z-]+>[A-Z-]+$)|(^[A-Z]{2,}_[A-Za-z_]+$)|([pcgrmn]\.)|(\d)/.test(value);
}

function extractCommonPrefix(groups: string[][]) {
  if (groups.length < 2) return [];

  const shortest = Math.min(...groups.map((group) => group.length));
  const prefix: string[] = [];

  for (let index = 0; index < shortest; index += 1) {
    const candidate = groups[0][index];
    if (groups.every((group) => group[index] === candidate)) {
      prefix.push(candidate);
      continue;
    }
    break;
  }

  return prefix;
}

function PreviewValue({
  value,
  mono = false,
  variant = "plain"
}: {
  value: string;
  mono?: boolean;
  variant?: "plain" | "chips" | "annotation";
}) {
  const entries = splitPreviewEntries(value);

  if (entries.length === 0) {
    return <div className="maf-preview-empty">-</div>;
  }

  if (variant === "chips") {
    return (
      <div className="maf-preview-chip-row">
        {entries.map((entry) => (
          <span key={entry} className={`maf-preview-chip${mono ? " maf-mono-cell" : ""}`}>
            {entry}
          </span>
        ))}
      </div>
    );
  }

  if (variant === "annotation") {
    const groups = entries
      .map((entry) =>
        entry
          .split(/\s*\|\s*/)
          .map((item) => item.trim())
          .filter(Boolean)
      )
      .filter((group) => group.length > 0);
    const sharedPrefix = extractCommonPrefix(groups);

    return (
      <div className="maf-preview-annotation">
        {sharedPrefix.length > 0 ? (
          <div className="maf-preview-chip-row maf-preview-chip-row--annotation-shared">
            {sharedPrefix.map((part) => (
              <span key={part} className={`maf-preview-chip maf-preview-chip--annotation${looksLikeNotation(part) ? " maf-mono-cell" : ""}`}>
                {part}
              </span>
            ))}
          </div>
        ) : null}

        <div className="maf-preview-list maf-preview-list--annotation">
          {groups.map((parts) => {
            const uniqueParts = sharedPrefix.length > 0 ? parts.slice(sharedPrefix.length) : parts;
            const visibleParts = uniqueParts.length > 0 ? uniqueParts : parts;
            const entryKey = parts.join("|");

            return (
              <div key={entryKey} className="maf-preview-item maf-preview-item--annotation">
                {visibleParts.map((part) => (
                  <span key={`${entryKey}-${part}`} className={`maf-preview-chip maf-preview-chip--annotation${looksLikeNotation(part) ? " maf-mono-cell" : ""}`}>
                    {part}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="maf-preview-list maf-preview-list--plain">
      {entries.map((entry) => (
        <div key={entry} className={`maf-preview-item maf-preview-item--plain${mono ? " maf-mono-cell" : ""}`}>
          {entry}
        </div>
      ))}
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
