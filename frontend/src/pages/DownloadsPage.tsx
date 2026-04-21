import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listDataFiles, listHealthyVcfFiles, toApiUrl } from "../api/client";
import { SampleBrowsePanel } from "../components/SampleBrowsePanel";
import { SectionHeader } from "../components/SectionHeader";
import type { DataFile } from "../types/api";
import { formatFileSize } from "../utils/format";

const FILE_TYPE_ORDER = ["Healthy VCF", "Variant Data", "MAF Summary", "Pan-Cancer Variants"];
const COHORT_ORDER = [
  "Healthy",
  "Breast",
  "Colorectal",
  "Liver",
  "Lung",
  "Pancreatic",
  "Pan-Cancer",
];

function rankByOrder(value: string, order: string[]) {
  const index = order.indexOf(value);
  return index >= 0 ? index : order.length;
}

export function DownloadsPage() {
  const [mode, setMode] = useState<"all" | "filtered">("all");
  const [selectedHealthy, setSelectedHealthy] = useState(false);
  const filesQuery = useQuery({ queryKey: ["data-files"], queryFn: listDataFiles });
  const healthyFilesQuery = useQuery({
    queryKey: ["healthy-vcf-files"],
    queryFn: listHealthyVcfFiles,
    enabled: selectedHealthy,
  });

  const grouped = useMemo(() => {
    const files = filesQuery.data ?? [];
    return files.reduce<Record<string, typeof files>>((acc, file) => {
      const key = file.cancer;
      acc[key] ??= [];
      acc[key].push(file);
      return acc;
    }, {});
  }, [filesQuery.data]);

  const sortedGroups = Object.entries(grouped).sort(
    ([a], [b]) => rankByOrder(a, COHORT_ORDER) - rankByOrder(b, COHORT_ORDER) || a.localeCompare(b)
  );
  const tableRows = useMemo(
    () =>
      sortedGroups.flatMap(([cancer, files]) =>
        [...files]
          .sort((a, b) => rankByOrder(a.fileType, FILE_TYPE_ORDER) - rankByOrder(b.fileType, FILE_TYPE_ORDER) || a.fileName.localeCompare(b.fileName))
          .map((file) => ({ ...file, cancer }))
      ),
    [sortedGroups]
  );
  const selectedHealthySummary = tableRows.find((file) => file.cancer === "Healthy" && file.fileType === "Healthy VCF");

  return (
    <div className="page-stack downloads-page">
      <SectionHeader
        eyebrow="Downloads"
        title="Aggregate, Healthy VCF, and filtered downloads"
        description="Choose between mounted cohort-level outputs, individual Healthy VCF files, and filtered multianno export from selected samples."
      />

      <section className="detail-card downloads-mode-card">
        <div className="statistics-panel-header">
          <h3 className="stat-pdf-title">Download mode</h3>
          <p className="statistics-panel-note">
            Switch between the complete mounted file table and the filtered sample export workflow.
          </p>
        </div>
        <div className="downloads-mode-switch">
          <button
            type="button"
            className={`statistics-cohort-pill${mode === "all" ? " active" : ""}`}
            onClick={() => setMode("all")}
          >
            All downloads
          </button>
          <button
            type="button"
            className={`statistics-cohort-pill${mode === "filtered" ? " active" : ""}`}
            onClick={() => setMode("filtered")}
          >
            Filtered downloads
          </button>
        </div>
      </section>

      {mode === "all" ? (
        <section className={`downloads-grid${selectedHealthy ? " downloads-grid--with-detail" : ""}`}>
          <article className="stat-pdf-card downloads-table-card">
            <div className="statistics-panel-header">
              <h3 className="stat-pdf-title">Whole-cohort file table</h3>
              <p className="statistics-panel-note">
                Download the mounted cohort-level outputs already present on disk, including multianno summaries, pan-cancer aggregates, and individual Healthy VCF files.
              </p>
            </div>
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
                  <h3>No files available yet</h3>
                  <p>Data files will appear here as pipeline processing completes for each cohort.</p>
                </section>
              )}
              {tableRows.length > 0 ? (
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
                      {tableRows.map((file) => (
                        <tr key={`${file.cancer}-${file.fileName}`}>
                          <td>{file.cancer}</td>
                          <td>{file.fileType}</td>
                          <td className="browse-mono">{file.fileName}</td>
                          <td>{formatFileSize(file.sizeBytes)}</td>
                          <td>
                            {file.cancer === "Healthy" && file.fileType === "Healthy VCF" ? (
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

      {mode === "filtered" ? (
        <section className="downloads-filtered-section">
          <SampleBrowsePanel
            compact
            mode="downloads"
            eyebrow="Filtered export"
            title="Filter samples and export matching files"
            description="Use the top filter bar to narrow cfDNA and Healthy samples, then review the table and export the selected mounted files as a zip."
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
    <aside className="stat-pdf-card downloads-healthy-detail-card">
      <div className="statistics-panel-header downloads-healthy-detail-header">
        <div>
          <h3 className="stat-pdf-title">Healthy VCF files</h3>
          <p className="statistics-panel-note">
            {summary ? `${summary.name} - ${formatFileSize(summary.sizeBytes)} total` : "Individual Healthy control VCF downloads."}
          </p>
        </div>
        <button type="button" className="browse-files-close" onClick={onClose}>&times;</button>
      </div>
      <div className="statistics-pdf-shell downloads-healthy-detail-shell">
        {loading ? <p className="panel-note">Loading Healthy VCF list...</p> : null}
        {error ? (
          <section className="detail-card empty-card">
            <h3>Healthy VCF list unavailable</h3>
            <p>Could not reach the backend server to list Healthy files.</p>
          </section>
        ) : null}
        {!loading && !error && files.length === 0 ? (
          <section className="detail-card empty-card">
            <h3>No Healthy VCF files found</h3>
            <p>The configured Healthy VCF directory did not return files.</p>
          </section>
        ) : null}
        {files.length > 0 ? (
          <div className="downloads-table-wrap downloads-healthy-file-wrap">
            <table className="data-table downloads-table downloads-healthy-file-table">
              <thead>
                <tr>
                  <th>Sample file</th>
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
