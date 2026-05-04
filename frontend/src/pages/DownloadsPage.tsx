import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listDataFiles, toApiUrl } from "../api/client";
import { SampleBrowsePanel } from "../components/SampleBrowsePanel";
import { formatCohortLabel } from "../utils/cohortLabels";
import { formatFileSize } from "../utils/format";

const FILE_TYPE_ORDER = [
  "Variant Data",
  "MAF Summary",
  "Public Mutations",
  "Public Plot",
  "Pan-Cancer Variants",
];
const COHORT_ORDER = [
  "Breast",
  "Colorectal",
  "Liver",
  "Lung",
  "Pancreatic",
  "Pan-Cancer",
];
const ALL_DOWNLOAD_PAGE_SIZES = [10, 25, 50, 100];

function rankByOrder(value: string, order: string[]) {
  const index = order.indexOf(value);
  return index >= 0 ? index : order.length;
}

export function DownloadsPage() {
  const [mode, setMode] = useState<"cohort" | "sample">("cohort");
  const [selectedCohorts, setSelectedCohorts] = useState<string[]>([]);
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>([]);
  const [allDownloadsPage, setAllDownloadsPage] = useState(1);
  const [allDownloadsPageSize, setAllDownloadsPageSize] = useState(10);
  const filesQuery = useQuery({ queryKey: ["data-files"], queryFn: listDataFiles });

  const grouped = useMemo(() => {
    const files = (filesQuery.data ?? []).filter((file) => file.cancer !== "Healthy");
    return files.reduce<Record<string, typeof files>>((acc, file) => {
      const key = file.cancer;
      acc[key] ??= [];
      acc[key].push(file);
      return acc;
    }, {});
  }, [filesQuery.data]);

  const sortedGroups = useMemo(
    () =>
      Object.entries(grouped).sort(
        ([a], [b]) => rankByOrder(a, COHORT_ORDER) - rankByOrder(b, COHORT_ORDER) || a.localeCompare(b)
      ),
    [grouped]
  );

  const allTableRows = useMemo(
    () =>
      sortedGroups.flatMap(([cancer, files]) =>
        [...files]
          .sort((a, b) => rankByOrder(a.fileType, FILE_TYPE_ORDER) - rankByOrder(b.fileType, FILE_TYPE_ORDER) || a.fileName.localeCompare(b.fileName))
          .map((file) => ({ ...file, cancer }))
      ),
    [sortedGroups]
  );
  const cohortOptions = useMemo(
    () =>
      Array.from(new Set(allTableRows.map((file) => file.cancer))).sort(
        (a, b) => rankByOrder(a, COHORT_ORDER) - rankByOrder(b, COHORT_ORDER) || a.localeCompare(b)
      ),
    [allTableRows]
  );
  const fileTypeOptions = useMemo(
    () =>
      Array.from(new Set(allTableRows.map((file) => file.fileType))).sort(
        (a, b) => rankByOrder(a, FILE_TYPE_ORDER) - rankByOrder(b, FILE_TYPE_ORDER) || a.localeCompare(b)
      ),
    [allTableRows]
  );
  const tableRows = useMemo(
    () =>
      allTableRows.filter((file) => {
        const cohortMatches = selectedCohorts.length === 0 || selectedCohorts.includes(file.cancer);
        const typeMatches = selectedFileTypes.length === 0 || selectedFileTypes.includes(file.fileType);
        return cohortMatches && typeMatches;
      }),
    [allTableRows, selectedCohorts, selectedFileTypes]
  );
  const allDownloadsTotalPages = Math.max(1, Math.ceil(tableRows.length / allDownloadsPageSize));
  const allDownloadsPageStart = (allDownloadsPage - 1) * allDownloadsPageSize;
  const paginatedTableRows = tableRows.slice(allDownloadsPageStart, allDownloadsPageStart + allDownloadsPageSize);
  const allDownloadsRangeStart = tableRows.length === 0 ? 0 : allDownloadsPageStart + 1;
  const allDownloadsRangeEnd = Math.min(allDownloadsPageStart + allDownloadsPageSize, tableRows.length);

  useEffect(() => {
    setAllDownloadsPage((previous) => Math.min(previous, allDownloadsTotalPages));
  }, [allDownloadsTotalPages]);

  const toggleCohortFilter = (cohort: string) => {
    setSelectedCohorts((previous) =>
      previous.includes(cohort) ? previous.filter((item) => item !== cohort) : [...previous, cohort]
    );
    setAllDownloadsPage(1);
  };

  const toggleFileTypeFilter = (fileType: string) => {
    setSelectedFileTypes((previous) =>
      previous.includes(fileType) ? previous.filter((item) => item !== fileType) : [...previous, fileType]
    );
    setAllDownloadsPage(1);
  };

  const resetCohortFileFilters = () => {
    setSelectedCohorts([]);
    setSelectedFileTypes([]);
    setAllDownloadsPage(1);
  };

  return (
    <div className="page-stack downloads-page">
      <section className="database-page-intro downloads-intro">
        <div>
          <h1>Download</h1>
          <p>
            Cohort-level resources and filtered sample exports for mounted ctDNA mutation datasets.
          </p>
        </div>
        <div className="downloads-mode-switch">
          <button
            type="button"
            className={`statistics-cohort-pill${mode === "cohort" ? " active" : ""}`}
            onClick={() => setMode("cohort")}
          >
            Cohort-level files
          </button>
          <button
            type="button"
            className={`statistics-cohort-pill${mode === "sample" ? " active" : ""}`}
            onClick={() => setMode("sample")}
          >
            Sample-level files
          </button>
        </div>
      </section>

      {mode === "cohort" ? (
        <section className="downloads-cohort-layout">
          <aside className="downloads-cohort-sidebar" aria-label="Cohort-level file filters">
            <div className="downloads-sidebar-head">
              <p className="section-eyebrow">Cohort-level filters</p>
              <h3>Filter mounted files</h3>
            </div>

            {(selectedCohorts.length > 0 || selectedFileTypes.length > 0) ? (
              <div className="browse-active-filters downloads-cohort-active-filters">
                <span className="browse-filters-label">Active filters</span>
                {selectedCohorts.map((cohort) => (
                  <button key={cohort} className="browse-filter-pill" type="button" onClick={() => toggleCohortFilter(cohort)}>
                    Cohort: {formatCohortLabel(cohort)} &times;
                  </button>
                ))}
                {selectedFileTypes.map((fileType) => (
                  <button key={fileType} className="browse-filter-pill" type="button" onClick={() => toggleFileTypeFilter(fileType)}>
                    Type: {fileType} &times;
                  </button>
                ))}
              </div>
            ) : null}

            <div className="downloads-cohort-filter-group">
              <span>Cohort</span>
              <div className="downloads-cohort-filter-list">
                {cohortOptions.map((cohort) => (
                  <button
                    key={cohort}
                    type="button"
                    className={`downloads-cohort-filter-option${selectedCohorts.includes(cohort) ? " active" : ""}`}
                    onClick={() => toggleCohortFilter(cohort)}
                  >
                    {formatCohortLabel(cohort)}
                  </button>
                ))}
              </div>
            </div>

            <div className="downloads-cohort-filter-group">
              <span>File type</span>
              <div className="downloads-cohort-filter-list">
                {fileTypeOptions.map((fileType) => (
                  <button
                    key={fileType}
                    type="button"
                    className={`downloads-cohort-filter-option${selectedFileTypes.includes(fileType) ? " active" : ""}`}
                    onClick={() => toggleFileTypeFilter(fileType)}
                  >
                    {fileType}
                  </button>
                ))}
              </div>
            </div>

            <button className="button-secondary downloads-filter-reset" type="button" onClick={resetCohortFileFilters}>
              Reset filters
            </button>
          </aside>

          <article className="downloads-table-card">
            <h2>Cohort-level file table</h2>
            <div className="statistics-pdf-shell downloads-table-shell">
              {filesQuery.isLoading && <p className="panel-note">Scanning available files...</p>}
              {filesQuery.isError && (
                <section className="detail-card empty-card">
                  <h3>Downloads unavailable</h3>
                  <p>Could not reach the backend server to list data files.</p>
                </section>
              )}
              {tableRows.length === 0 && !filesQuery.isLoading && !filesQuery.isError && (
                <section className="detail-card empty-card">
                  {allTableRows.length === 0 ? (
                    <>
                      <h3>No cohort-level files available yet</h3>
                      <p>Data files will appear here as pipeline processing completes for each cohort.</p>
                    </>
                  ) : (
                    <>
                      <h3>No cohort-level files match the filters</h3>
                      <p>Reset the cohort or file-type filters to review all mounted cohort resources.</p>
                    </>
                  )}
                </section>
              )}
              {tableRows.length > 0 ? (
                <>
                  <div className="downloads-table-toolbar">
                    <span>
                      Showing {allDownloadsRangeStart}-{allDownloadsRangeEnd} of {tableRows.length} files
                    </span>
                    <label className="maf-page-size downloads-page-size">
                      Rows per page
                      <select
                        value={allDownloadsPageSize}
                        onChange={(event) => {
                          setAllDownloadsPageSize(Number(event.target.value));
                          setAllDownloadsPage(1);
                        }}
                      >
                        {ALL_DOWNLOAD_PAGE_SIZES.map((size) => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="downloads-table-wrap">
                    <table className="data-table downloads-table">
                      <thead>
                        <tr>
                          <th>Cohort</th>
                          <th>Type</th>
                          <th>File</th>
                          <th>Size</th>
                          <th>Download</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTableRows.map((file) => (
                          <tr key={`${file.cancer}-${file.fileName}`}>
                            <td>{formatCohortLabel(file.cancer)}</td>
                            <td>{file.fileType}</td>
                            <td className="browse-mono">{file.fileName}</td>
                            <td>{formatFileSize(file.sizeBytes)}</td>
                            <td>
                              <a className="button-secondary" href={toApiUrl(file.downloadUrl)} download={file.fileName}>
                                Download
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="pagination-bar downloads-pagination">
                    <button
                      className="button-secondary"
                      type="button"
                      disabled={allDownloadsPage <= 1}
                      onClick={() => setAllDownloadsPage((previous) => Math.max(previous - 1, 1))}
                    >
                      Previous
                    </button>
                    <span>
                      Page {allDownloadsPage} / {allDownloadsTotalPages}
                    </span>
                    <button
                      className="button-secondary"
                      type="button"
                      disabled={allDownloadsPage >= allDownloadsTotalPages}
                      onClick={() => setAllDownloadsPage((previous) => Math.min(previous + 1, allDownloadsTotalPages))}
                    >
                      Next
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </article>
        </section>
      ) : null}

      {mode === "sample" ? (
        <section className="downloads-filtered-section">
          <SampleBrowsePanel
            compact
            mode="downloads"
            eyebrow="Sample-level files"
            title="Filter samples and export matching files"
          />
        </section>
      ) : null}
    </div>
  );
}
