import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listDataFiles, toApiUrl } from "../api/client";
import { SampleBrowsePanel } from "../components/SampleBrowsePanel";
import { SectionHeader } from "../components/SectionHeader";
import { formatFileSize } from "../utils/format";

const FILE_TYPE_ORDER = ["Variant Data", "MAF Summary", "Pan-Cancer Variants"];

export function DownloadsPage() {
  const [mode, setMode] = useState<"all" | "filtered">("all");
  const filesQuery = useQuery({ queryKey: ["data-files"], queryFn: listDataFiles });

  const grouped = useMemo(() => {
    const files = filesQuery.data ?? [];
    return files.reduce<Record<string, typeof files>>((acc, file) => {
      const key = file.cancer;
      acc[key] ??= [];
      acc[key].push(file);
      return acc;
    }, {});
  }, [filesQuery.data]);

  const cancerOrder = ["Breast", "Colonrector", "Liver", "Lung", "Pdac", "Pan-Cancer"];
  const sortedGroups = Object.entries(grouped).sort(
    ([a], [b]) => (cancerOrder.indexOf(a) ?? 99) - (cancerOrder.indexOf(b) ?? 99)
  );
  const tableRows = useMemo(
    () =>
      sortedGroups.flatMap(([cancer, files]) =>
        [...files]
          .sort((a, b) => (FILE_TYPE_ORDER.indexOf(a.fileType) ?? 99) - (FILE_TYPE_ORDER.indexOf(b.fileType) ?? 99))
          .map((file) => ({ ...file, cancer }))
      ),
    [sortedGroups]
  );

  return (
    <div className="page-stack downloads-page">
      <SectionHeader
        eyebrow="Downloads"
        title="Aggregate and filtered multianno downloads"
        description="Choose between full cohort-level output tables and filtered multianno export from selected samples."
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
        <section className="downloads-grid">
          <article className="stat-pdf-card downloads-table-card">
            <div className="statistics-panel-header">
              <h3 className="stat-pdf-title">Whole-cohort file table</h3>
              <p className="statistics-panel-note">
                Download the mounted cohort-level outputs already present on disk, including multianno summaries and pan-cancer aggregates.
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
            title="Filter samples and export matching multianno bundles"
            description="Use the top filter bar to narrow samples, then review the table and export the matching multianno files as a zip."
          />
        </section>
      ) : null}
    </div>
  );
}
