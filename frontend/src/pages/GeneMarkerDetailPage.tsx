import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getMafGeneDetail, queryMafGeneMutations } from "../api/client";
import { IgvBrowser } from "../components/IgvBrowser";
import { formatNumber } from "../utils/format";

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 5;

type SourceKey = "cfDNA" | "private" | "GEO" | "TCGA";

const SOURCE_LABELS: Record<SourceKey, string> = {
  cfDNA: "cfDNA All",
  private: "cfDNA Private",
  GEO: "cfDNA GEO",
  TCGA: "TCGA",
};

export function GeneMarkerDetailPage() {
  const { geneSymbol = "" } = useParams();
  const [searchParams] = useSearchParams();
  const urlSource = searchParams.get("source");
  const detailSource: SourceKey = (urlSource === "TCGA" || urlSource === "GEO" || urlSource === "private") ? urlSource : "cfDNA";

  const buildBackLink = () => {
    const params = new URLSearchParams();
    params.set("gene", geneSymbol);
    const urlSource = searchParams.get("source");
    if (urlSource) params.set("source", urlSource);
    return `/gene-search?${params.toString()}`;
  };

  return (
    <div className="page-stack maf-page maf-detail-page">
      <section className="maf-hero maf-detail-header">
        <div className="maf-hero-copy">
          <span className="maf-eyebrow">Gene Detail</span>
          <h2>{geneSymbol}</h2>
          <p>
            Sample-level mutation records for <strong>{geneSymbol}</strong> from {SOURCE_LABELS[detailSource] ?? detailSource}.
          </p>
        </div>
        <div className="maf-detail-actions">
          <Link className="button-secondary" to={buildBackLink()}>Back to Gene Search</Link>
        </div>
      </section>

      <SourceDetailPanel source={detailSource} geneSymbol={geneSymbol} />
    </div>
  );
}

function SourceDetailPanel({ source, geneSymbol }: { source: SourceKey; geneSymbol: string }) {
  const isCfDNA = source !== "TCGA";
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const summaryQ = useQuery({
    queryKey: ["maf-gene-detail", source, geneSymbol],
    queryFn: () => getMafGeneDetail(geneSymbol, { source }),
    placeholderData: keepPreviousData,
    enabled: geneSymbol.length > 0,
  });

  const dataQ = useQuery({
    queryKey: ["maf-gene-mutations", source, geneSymbol, page, pageSize],
    queryFn: () => queryMafGeneMutations(geneSymbol, { source, page, size: pageSize }),
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
  const igvMutations = useMemo(() => igvMutationsQ.data?.content ?? [], [igvMutationsQ.data]);

  const goToPage = (nextPage: number) => setPage(Math.max(1, nextPage));
  const changePageSize = (nextSize: number) => {
    setPageSize(nextSize);
    setPage(1);
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

      <div className="maf-results-panel">
        <div className="maf-results-header">
          <div>
            <h3>Genome Browser</h3>
            <p>Interactive mutation map for <strong>{geneSymbol}</strong> on hg38.</p>
          </div>
          <div className="maf-results-hint">
            {isCfDNA ? "Each track is a cancer cohort." : "Each track is a cancer type."} Hover mutations for details.
          </div>
        </div>

        {igvMutationsQ.isLoading ? (
          <p className="panel-note">Loading mutation map...</p>
        ) : (
          <IgvBrowser gene={geneSymbol} mutations={igvMutations} cancerTypes={[]} />
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
          <label className="maf-page-size-field">
            <span>Rows per page</span>
            <select value={pageSize} onChange={(event) => changePageSize(Number(event.target.value))}>
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

        {dataQ.isLoading ? <p className="panel-note">Loading mutation records...</p> : null}
        {dataQ.isError ? (
          <p className="panel-note" style={{ color: "#c0392b" }}>Failed to load mutation detail.</p>
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
                      {isCfDNA ? <th>Cancer</th> : <th>Cancer</th>}
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
                        <td>{row.cancerType || "-"}</td>
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
                <span>Page {currentPage} / {totalPages || 1}</span>
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
