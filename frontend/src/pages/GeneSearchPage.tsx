import { useState, useEffect, type FormEvent, type ReactNode } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { queryMafMutations } from "../api/client";
import { formatNumber } from "../utils/format";

const PAGE_SIZE = 20;
const DEFAULT_GENE = "TP53";
const SOURCE_OPTIONS = ["cfDNA", "TCGA"] as const;

const CANCER_TYPES = [
  "Bladder", "Brain", "Breast", "Cervical", "CRC",
  "Endometrium", "Esophageal", "Experiment", "Gastric",
  "Head_and_neck", "Kidney", "Liver", "Lung", "NGY",
  "Other", "Ovarian", "PDAC", "Thyriod"
];

const CHROMOSOMES = [
  "1","2","3","4","5","6","7","8","9","10","11","12",
  "13","14","15","16","17","18","19","20","21","22","X","Y"
];

const VARIANT_CLASSIFICATIONS = [
  "Frame_Shift_Del", "Frame_Shift_Ins", "In_Frame_Del", "In_Frame_Ins",
  "Missense_Mutation", "Nonsense_Mutation", "Nonstop_Mutation", "Translation_Start_Site"
];

const VARIANT_TYPES = ["SNP", "INS", "DEL", "DNP", "TNP", "ONP"];

export function GeneSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const source = searchParams.get("source") ?? "cfDNA";
  const gene = searchParams.get("gene") ?? DEFAULT_GENE;
  const cancerType = searchParams.get("cancerType") ?? "";
  const chromosome = searchParams.get("chromosome") ?? "";
  const variantClass = searchParams.get("variantClass") ?? "";
  const variantType = searchParams.get("variantType") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const [geneInput, setGeneInput] = useState(gene);

  useEffect(() => { setGeneInput(gene); }, [gene]);

  console.log("[GeneSearchPage] render — source=%s gene=%s page=%d", source, gene, page);

  const dataQ = useQuery({
    queryKey: ["maf-mutations", source, gene, cancerType, chromosome, variantClass, variantType, page],
    queryFn: () => {
      console.log("[GeneSearchPage] firing queryMafMutations:", { source, gene, cancerType, chromosome, variantClass, variantType, page });
      return queryMafMutations({
        source,
        gene: gene || undefined,
        cancerType: cancerType || undefined,
        chromosome: chromosome || undefined,
        variantClass: variantClass || undefined,
        variantType: variantType || undefined,
        page,
        size: PAGE_SIZE
      });
    },
    placeholderData: keepPreviousData
  });

  const paged = dataQ.data;
  const rows = paged?.content ?? [];
  const totalElements = paged?.totalElements ?? 0;
  const totalPages = paged?.totalPages ?? 1;
  const currentPage = Math.min(page, totalPages || 1);
  const startIndex = totalElements === 0 ? 0 : (currentPage - 1) * PAGE_SIZE;

  const setParam = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams);
    if (value) p.set(key, value); else p.delete(key);
    p.set("page", "1");
    setSearchParams(p);
  };

  const applyGeneSearch = (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = geneInput.trim();
    console.log("[GeneSearchPage] Search clicked, geneInput=%s, current gene=%s", trimmed, gene);
    if (trimmed === gene) {
      dataQ.refetch();
    } else {
      setParam("gene", trimmed);
    }
  };

  const changeSource = (s: string) => {
    const p = new URLSearchParams();
    p.set("source", s);
    p.set("gene", DEFAULT_GENE);
    p.set("page", "1");
    setGeneInput(DEFAULT_GENE);
    setSearchParams(p);
  };

  const clearFilters = () => {
    setGeneInput(DEFAULT_GENE);
    const p = new URLSearchParams();
    p.set("source", source);
    p.set("gene", DEFAULT_GENE);
    p.set("page", "1");
    setSearchParams(p);
  };

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(p));
    setSearchParams(params);
  };

  const isCfDNA = source === "cfDNA";

  return (
    <div className="page-stack markerdb-page">
      <section className="detail-card markerdb-search-header">
        <div>
          <h2>Gene Search</h2>
          <p>Browse somatic mutations from cfDNA and TCGA MAF datasets. Filter by gene, cancer type, chromosome, and variant classification.</p>
        </div>

        <form className="markerdb-inline-search" onSubmit={applyGeneSearch}>
          <input
            value={geneInput}
            onChange={(e) => setGeneInput(e.target.value)}
            placeholder="Search by gene symbol (e.g. TP53)"
          />
          <button className="button-secondary" type="submit">Search</button>
        </form>
      </section>

      {/* Data source tabs */}
      <section className="detail-card" style={{ padding: "12px 20px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontWeight: 500 }}>Data Source:</span>
          {SOURCE_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className={source === s ? "button-primary" : "button-secondary"}
              onClick={() => changeSource(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      {/* Static filter panel */}
      <section className="detail-card markerdb-filter-panel">
        {isCfDNA && (
          <FilterGroup title="Cancer Type">
            {CANCER_TYPES.map((ct) => (
              <label key={ct} className="markerdb-check">
                <input
                  type="checkbox"
                  checked={cancerType === ct}
                  onChange={() => setParam("cancerType", cancerType === ct ? "" : ct)}
                />
                <span>{ct}</span>
              </label>
            ))}
          </FilterGroup>
        )}

        <FilterGroup title="Chromosome">
          {CHROMOSOMES.map((chr) => (
            <label key={chr} className="markerdb-check">
              <input
                type="checkbox"
                checked={chromosome === chr}
                onChange={() => setParam("chromosome", chromosome === chr ? "" : chr)}
              />
              <span>chr{chr}</span>
            </label>
          ))}
        </FilterGroup>

        <FilterGroup title="Variant Classification">
          {VARIANT_CLASSIFICATIONS.map((vc) => (
            <label key={vc} className="markerdb-check">
              <input
                type="checkbox"
                checked={variantClass === vc}
                onChange={() => setParam("variantClass", variantClass === vc ? "" : vc)}
              />
              <span>{vc}</span>
            </label>
          ))}
        </FilterGroup>

        <FilterGroup title="Variant Type">
          {VARIANT_TYPES.map((vt) => (
            <label key={vt} className="markerdb-check">
              <input
                type="checkbox"
                checked={variantType === vt}
                onChange={() => setParam("variantType", variantType === vt ? "" : vt)}
              />
              <span>{vt}</span>
            </label>
          ))}
        </FilterGroup>

        <div className="markerdb-filter-actions">
          <button className="button-secondary" type="button" onClick={clearFilters}>Clear All Filters</button>
        </div>
      </section>

      {/* Loading / error */}
      {dataQ.isLoading && <p className="panel-note">Loading mutations...</p>}
      {dataQ.isError && (
        <p className="panel-note" style={{ color: "#c0392b" }}>
          Failed to load mutation data. Check browser console (F12) for details.
        </p>
      )}

      {/* Results table */}
      {!dataQ.isLoading && !dataQ.isError && (
        <section className="detail-card markerdb-results-panel">
          <div className="markerdb-results-meta">
            <span>
              Showing {totalElements === 0 ? 0 : startIndex + 1}
              {" – "}
              {Math.min(startIndex + PAGE_SIZE, totalElements)} of {formatNumber(totalElements)} mutations
            </span>
          </div>

          {rows.length === 0 ? (
            <div className="browse-empty-state">
              <h4>No mutations found</h4>
              <p>Try broadening your search or clearing filters.</p>
            </div>
          ) : (
            <>
              <div className="markerdb-table-wrap">
                <table className="markerdb-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Gene</th>
                      {isCfDNA && <th>Cancer Type</th>}
                      <th>Chr</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Ref</th>
                      <th>Alt</th>
                      <th>Classification</th>
                      <th>Type</th>
                      <th>Sample</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.id}</td>
                        <td><strong>{row.hugoSymbol}</strong></td>
                        {isCfDNA && <td>{row.cancerType}</td>}
                        <td>{row.chromosome}</td>
                        <td>{row.startPosition}</td>
                        <td>{row.endPosition}</td>
                        <td className="mono-cell">{row.referenceAllele}</td>
                        <td className="mono-cell">{row.tumorSeqAllele2}</td>
                        <td>{row.variantClassification}</td>
                        <td>{row.variantType}</td>
                        <td style={{ fontSize: "0.82rem" }}>{row.tumorSampleBarcode}</td>
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
          )}
        </section>
      )}
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="markerdb-filter-group">
      <p>{title}</p>
      <div className="markerdb-check-grid">{children}</div>
    </div>
  );
}
