import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listDataFiles, toApiUrl } from "../api/client";
import { SampleBrowsePanel } from "../components/SampleBrowsePanel";
import { SectionHeader } from "../components/SectionHeader";
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

function rankByOrder(value: string, order: string[]) {
  const index = order.indexOf(value);
  return index >= 0 ? index : order.length;
}

export function DownloadsPage() {
  const [mode, setMode] = useState<"all" | "filtered">("all");
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

  return (
    <div className="page-stack downloads-page">
      <SectionHeader
        eyebrow="Download"
        title="Aggregate and filtered downloads"
      />

      <section className="detail-card downloads-mode-card">
        <div className="statistics-panel-header">
          <h3 className="stat-pdf-title">Download mode</h3>
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
        <section className="downloads-grid">
          <article className="stat-pdf-card downloads-table-card">
            <div className="statistics-panel-header">
              <h3 className="stat-pdf-title">Whole-cohort file table</h3>
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
              ) : null}
            </div>
          </article>
        </section>
      ) : null}

      {mode === "filtered" ? (
        <section className="downloads-filtered-section">
          <SampleBrowsePanel
            compact
            mode="downloads"
            eyebrow="Filtered export"
            title="Filter samples and export matching files"
          />
        </section>
      ) : null}
    </div>
  );
}
