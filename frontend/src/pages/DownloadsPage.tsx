import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listDataFiles, toApiUrl } from "../api/client";
import { SectionHeader } from "../components/SectionHeader";
import { formatFileSize } from "../utils/format";

const FILE_TYPE_ORDER = ["Variant Data", "MAF Summary", "Pan-Cancer Variants"];

export function DownloadsPage() {
  const filesQuery = useQuery({ queryKey: ["data-files"], queryFn: listDataFiles });

  const grouped = useMemo(() => {
    const files = filesQuery.data ?? [];
    return files.reduce<Record<string, typeof files>>((acc, f) => {
      const key = f.cancer;
      acc[key] ??= [];
      acc[key].push(f);
      return acc;
    }, {});
  }, [filesQuery.data]);

  const cancerOrder = ["Breast", "Colonrector", "Liver", "Lung", "Pdac", "Pan-Cancer"];
  const sortedGroups = Object.entries(grouped).sort(
    ([a], [b]) => (cancerOrder.indexOf(a) ?? 99) - (cancerOrder.indexOf(b) ?? 99)
  );

  return (
    <div className="page-stack">
      <SectionHeader
        eyebrow="Downloads"
        title="Data file downloads"
        description="Aggregate variant files, MAF summaries, and pan-cancer datasets available from the cfDNA server. Files are served directly from the analysis pipeline output."
      />

      {filesQuery.isLoading && <p className="panel-note">Scanning available files...</p>}
      {filesQuery.isError && (
        <section className="detail-card empty-card">
          <h3>Downloads unavailable</h3>
          <p>Could not reach the backend server to list data files.</p>
        </section>
      )}

      {sortedGroups.length === 0 && !filesQuery.isLoading && !filesQuery.isError && (
        <section className="detail-card empty-card">
          <h3>No files available yet</h3>
          <p>Data files will appear here as pipeline processing completes for each cohort.</p>
        </section>
      )}

      {sortedGroups.map(([cancer, files]) => {
        const sorted = [...files].sort(
          (a, b) => (FILE_TYPE_ORDER.indexOf(a.fileType) ?? 99) - (FILE_TYPE_ORDER.indexOf(b.fileType) ?? 99)
        );
        return (
          <section key={cancer} className="detail-card">
            <h3>{cancer}</h3>
            <ul className="download-list">
              {sorted.map((file) => (
                <li key={file.fileName}>
                  <div>
                    <strong>{file.name}</strong>
                    <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>{file.fileType}</p>
                  </div>
                  <div className="download-meta">
                    <span style={{ fontFamily: "monospace", fontSize: "0.82rem" }}>{file.fileName}</span>
                    <span>{formatFileSize(file.sizeBytes)}</span>
                    <a
                      className="button-secondary"
                      href={toApiUrl(file.downloadUrl)}
                      download={file.fileName}
                    >
                      Download
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
