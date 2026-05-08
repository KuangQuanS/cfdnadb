import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listDataFiles, listHealthyVcfFiles, toApiUrl } from "../api/client";
import { SampleBrowsePanel } from "../components/SampleBrowsePanel";
import { CANCER_OPTIONS } from "../constants/cfdna";
import type { DataFile } from "../types/api";
import { formatCohortLabel } from "../utils/cohortLabels";
import { formatFileSize } from "../utils/format";

const FILE_TYPE_ORDER = [
  "Healthy PON",
  "Variant Data",
  "MAF Summary",
  "Public Mutations",
  "Pan-Cancer Variants",
];
const COHORT_ORDER = [
  "Bladder",
  "Brain",
  "Breast",
  "Cervical",
  "Colorectal",
  "Endometrial",
  "Esophageal",
  "Gastric",
  "HeadAndNeck",
  "Healthy",
  "Kidney",
  "Liver",
  "Lung",
  "Ovarian",
  "Pan-Cancer",
  "Pancreatic",
  "Thyroid",
  "Benign_Tumor",
];
const DOWNLOAD_COHORT_OPTIONS = [...COHORT_ORDER] as const;
const ALL_DOWNLOAD_PAGE_SIZES = [10, 25, 50, 100];
const DOWNLOAD_METADATA_CACHE_MS = 30 * 60_000;
const DOWNLOAD_METADATA_GC_MS = 2 * 60 * 60_000;

function rankByOrder(value: string, order: string[]) {
  const index = order.indexOf(value);
  return index >= 0 ? index : order.length;
}

export function DownloadsPage() {
  const [mode, setMode] = useState<"cohort" | "sample">("cohort");
  const [selectedCohorts, setSelectedCohorts] = useState<string[]>([]);
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>([]);
  const [selectedHealthy, setSelectedHealthy] = useState(false);
  const [allDownloadsPage, setAllDownloadsPage] = useState(1);
  const [allDownloadsPageSize, setAllDownloadsPageSize] = useState(10);
  const filesQuery = useQuery({
    queryKey: ["data-files"],
    queryFn: listDataFiles,
    staleTime: DOWNLOAD_METADATA_CACHE_MS,
    gcTime: DOWNLOAD_METADATA_GC_MS,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
  const healthyFilesQuery = useQuery({
    queryKey: ["healthy-vcf-files"],
    queryFn: listHealthyVcfFiles,
    staleTime: DOWNLOAD_METADATA_CACHE_MS,
    gcTime: DOWNLOAD_METADATA_GC_MS,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  const dataFiles = useMemo<DataFile[]>(() => {
    const files = filesQuery.data ?? [];
    const hasHealthySummary = files.some((file) => file.cancer === "Healthy" && file.fileType === "Healthy PON");
    const healthyFiles = healthyFilesQuery.data ?? [];
    if (hasHealthySummary || healthyFiles.length === 0) {
      return files;
    }
    const totalSize = healthyFiles.reduce((sum, file) => sum + file.sizeBytes, 0);
    return [
      ...files,
      {
        cancer: "Healthy",
        fileType: "Healthy PON",
        name: `Healthy PON files (${healthyFiles.length} integrated files)`,
        fileName: "healthy-pon-files",
        sizeBytes: totalSize,
        downloadUrl: "",
      },
    ];
  }, [filesQuery.data, healthyFilesQuery.data]);

  const grouped = useMemo(() => {
    return dataFiles.reduce<Record<string, typeof dataFiles>>((acc, file) => {
      const key = file.cancer;
      acc[key] ??= [];
      acc[key].push(file);
      return acc;
    }, {});
  }, [dataFiles]);

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
      DOWNLOAD_COHORT_OPTIONS.filter(
        (cohort) => cohort === "Healthy" || cohort === "Pan-Cancer" || (CANCER_OPTIONS as readonly string[]).includes(cohort)
      ),
    []
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
  const selectedHealthySummary = tableRows.find((file) => file.cancer === "Healthy" && file.fileType === "Healthy PON");
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
        <section className={`downloads-cohort-layout${selectedHealthy ? " downloads-cohort-layout--with-detail" : ""}`}>
          <aside className="downloads-cohort-sidebar tool-sidebar-panel" aria-label="Cohort-level file filters">
            <div className="downloads-sidebar-head">
              <h3>Filter</h3>
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

          <article className="downloads-table-card tool-section-panel">
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
                              {file.cancer === "Healthy" && file.fileType === "Healthy PON" ? (
                                <button className="button-secondary" type="button" onClick={() => setSelectedHealthy(true)}>
                                  View files
                                </button>
                              ) : (
                                <a className="button-secondary" href={toApiUrl(file.downloadUrl)} download={file.fileName}>
                                  Download
                                </a>
                              )}
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
          {selectedHealthy ? (
            <HealthyVcfDetailPanel
              summary={selectedHealthySummary}
              files={healthyFilesQuery.data ?? []}
              loading={healthyFilesQuery.isLoading}
              error={healthyFilesQuery.isError}
              onClose={() => setSelectedHealthy(false)}
            />
          ) : null}
        </section>
      ) : null}

      {mode === "sample" ? (
        <section className="downloads-filtered-section">
          <SampleBrowsePanel
            compact
            mode="downloads"
            eyebrow=""
            title="Filter"
          />
        </section>
      ) : null}
    </div>
  );
}

function HealthyVcfDetailPanel({
  summary,
  files,
  loading,
  error,
  onClose,
}: {
  summary?: DataFile;
  files: DataFile[];
  loading: boolean;
  error: boolean;
  onClose: () => void;
}) {
  return (
    <aside className="downloads-healthy-detail-card">
      <div className="statistics-panel-header downloads-healthy-detail-header">
        <div>
          <h3 className="stat-pdf-title">Healthy PON files</h3>
          <p className="statistics-panel-note">
            {summary ? `${summary.name} - ${formatFileSize(summary.sizeBytes)} total` : "Integrated Healthy PON downloads."}
          </p>
        </div>
        <button type="button" className="browse-files-close" onClick={onClose}>&times;</button>
      </div>
      <div className="statistics-pdf-shell downloads-healthy-detail-shell">
        {loading ? <p className="panel-note">Loading Healthy PON file list...</p> : null}
        {error ? (
          <section className="detail-card empty-card">
            <h3>Healthy PON list unavailable</h3>
            <p>Could not reach the backend server to list Healthy files.</p>
          </section>
        ) : null}
        {!loading && !error && files.length === 0 ? (
          <section className="detail-card empty-card">
            <h3>No Healthy PON files found</h3>
            <p>The configured Healthy PON directory did not return files.</p>
          </section>
        ) : null}
        {files.length > 0 ? (
          <div className="downloads-table-wrap downloads-healthy-file-wrap">
            <table className="data-table downloads-table downloads-healthy-file-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Size</th>
                  <th>Download</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.fileName}>
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
        ) : null}
      </div>
    </aside>
  );
}
