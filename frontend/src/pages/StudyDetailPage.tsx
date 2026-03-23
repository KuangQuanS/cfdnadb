import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { getStudy } from "../api/client";
import { SectionHeader } from "../components/SectionHeader";
import { formatFileSize, formatNumber } from "../utils/format";

export function StudyDetailPage() {
  const params = useParams();
  const studyId = params.id ?? "1";
  const studyQuery = useQuery({ queryKey: ["study", studyId], queryFn: () => getStudy(studyId) });

  if (!studyQuery.data) {
    return <p className="panel-note">Loading study...</p>;
  }

  const study = studyQuery.data;

  return (
    <div className="page-stack">
      <SectionHeader eyebrow={study.accession} title={study.title} description={study.abstractText ?? "No abstract available."} />

      <section className="detail-grid">
        <article className="detail-card">
          <h3>Study metadata</h3>
          <dl>
            <div><dt>Disease</dt><dd>{study.diseaseType}</dd></div>
            <div><dt>Sample source</dt><dd>{study.sampleSource}</dd></div>
            <div><dt>Technology</dt><dd>{study.technology}</dd></div>
            <div><dt>Journal</dt><dd>{study.journal ?? "-"}</dd></div>
            <div><dt>Year</dt><dd>{study.publicationYear ?? "-"}</dd></div>
            <div><dt>Cohort size</dt><dd>{formatNumber(study.cohortSize)}</dd></div>
            <div><dt>DOI</dt><dd>{study.doi ?? "-"}</dd></div>
            <div><dt>PMID</dt><dd>{study.pmid ?? "-"}</dd></div>
          </dl>
        </article>
        <article className="detail-card">
          <h3>Recommended citation</h3>
          <p>{study.citation ?? "Citation not available."}</p>
          <h3>Available datasets</h3>
          <ul className="compact-list">
            {study.datasets.map((dataset) => (
              <li key={dataset.id}>{dataset.name} ({dataset.fileFormat ?? "-"}, {formatNumber(dataset.recordCount)})</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="detail-card">
        <h3>Sample groups</h3>
        <ul className="compact-list">
          {study.sampleGroups.length === 0 ? <li>No sample-group breakdown available.</li> : study.sampleGroups.map((group) => (
            <li key={group.id}>{group.groupName}: {formatNumber(group.sampleCount)} samples</li>
          ))}
        </ul>
      </section>

      <section className="detail-card">
        <h3>Representative biomarkers</h3>
        <ul className="compact-list">
          {study.biomarkers.map((marker) => (
            <li key={marker.id}>{marker.markerName} ({marker.markerType})</li>
          ))}
        </ul>
      </section>

      <section className="detail-card">
        <h3>Study-linked downloads</h3>
        <ul className="download-list">
          {study.downloads.length === 0 ? <li>No dedicated study downloads are attached yet.</li> : study.downloads.map((asset) => (
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
    </div>
  );
}
