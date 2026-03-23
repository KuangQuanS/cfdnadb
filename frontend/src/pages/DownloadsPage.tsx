import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDownloads } from "../api/client";
import { SectionHeader } from "../components/SectionHeader";
import { formatFileSize } from "../utils/format";

export function DownloadsPage() {
  const downloadsQuery = useQuery({ queryKey: ["downloads"], queryFn: getDownloads });

  const grouped = useMemo(() => {
    const assets = downloadsQuery.data ?? [];
    return assets.reduce<Record<string, typeof assets>>((accumulator, asset) => {
      accumulator[asset.category] ??= [];
      accumulator[asset.category].push(asset);
      return accumulator;
    }, {});
  }, [downloadsQuery.data]);

  return (
    <div className="page-stack">
      <SectionHeader
        eyebrow="Downloads"
        title="Public data releases"
        description="Organized into full release files, study-level subsets, and supporting schema documentation."
      />
      {Object.entries(grouped).map(([category, assets]) => (
        <section key={category} className="detail-card">
          <h3>{category}</h3>
          <ul className="download-list">
            {assets.map((asset) => (
              <li key={asset.id}>
                <div>
                  <strong>{asset.name}</strong>
                  <p>{asset.description}</p>
                </div>
                <div className="download-meta">
                  <span>{asset.fileName}</span>
                  <span>{formatFileSize(asset.fileSizeBytes)}</span>
                  <a className="button-secondary" href={asset.downloadUrl}>Download</a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
