import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { getVafBodyMap } from "../api/client";
import { SectionHeader } from "../components/SectionHeader";
import type { VafBodyMapEntry } from "../types/api";

const DEFAULT_GENE = "ERBB2";

type OrganNode = {
  organKey: string;
  label: string;
  icon: string;
  left: number;
  top: number;
};

const ORGAN_NODES: OrganNode[] = [
  { organKey: "brain", label: "Brain", icon: "brain", left: 50, top: 9 },
  { organKey: "lung", label: "Lung", icon: "lung", left: 22, top: 20 },
  { organKey: "breast", label: "Breast", icon: "breast", left: 78, top: 20 },
  { organKey: "thyroid", label: "Thyroid", icon: "thyroid", left: 90, top: 43 },
  { organKey: "kidney", label: "Kidney", icon: "kidney", left: 84, top: 68 },
  { organKey: "ovarian", label: "Ovarian", icon: "ovarian", left: 64, top: 87 },
  { organKey: "bladder", label: "Bladder", icon: "bladder", left: 36, top: 87 },
  { organKey: "colorectal", label: "Colorectal", icon: "colon", left: 16, top: 68 },
  { organKey: "liver", label: "Liver", icon: "liver", left: 10, top: 43 },
  { organKey: "gastric", label: "Gastric", icon: "stomach", left: 30, top: 57 },
  { organKey: "pancreatic", label: "Pancreatic", icon: "pancreas", left: 70, top: 57 },
];

function formatVaf(value: number) {
  if (!Number.isFinite(value)) return "-";
  return value.toFixed(3);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function buildOrganEntryMap(entries: VafBodyMapEntry[]) {
  const map = new Map<string, VafBodyMapEntry>();
  for (const entry of entries) {
    const current = map.get(entry.organKey);
    if (!current || entry.meanVaf > current.meanVaf) {
      map.set(entry.organKey, entry);
    }
  }
  return map;
}

function markerColor(ratio: number) {
  if (ratio >= 0.67) return "#d95f45";
  if (ratio >= 0.34) return "#f0a142";
  return "#3f9caf";
}

function OrganIcon({ icon }: { icon: string }) {
  if (icon === "lung") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 9v27" />
        <path d="M21 17c-7 2-11 8-11 18 0 4 2 6 5 6 6 0 8-8 8-18 0-3-1-5-2-6Z" />
        <path d="M27 17c7 2 11 8 11 18 0 4-2 6-5 6-6 0-8-8-8-18 0-3 1-5 2-6Z" />
      </svg>
    );
  }
  if (icon === "breast") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M10 30c2-9 8-15 14-15s12 6 14 15" />
        <circle cx="18" cy="31" r="8" />
        <circle cx="30" cy="31" r="8" />
      </svg>
    );
  }
  if (icon === "liver") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M7 28c5-13 18-17 34-13 0 11-9 20-23 20-5 0-9-2-11-7Z" />
        <path d="M30 20c5 2 8 6 9 11" />
      </svg>
    );
  }
  if (icon === "stomach") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 7c2 8-3 11-2 17 1 5 9 4 9 10 0 5-5 8-11 8-8 0-13-5-13-12 0-6 4-10 11-11" />
        <path d="M24 7c4 2 6 5 6 9" />
      </svg>
    );
  }
  if (icon === "colon") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M15 10h18c4 0 7 3 7 7v17c0 4-3 7-7 7H18c-4 0-7-3-7-7V20c0-4 3-7 7-7h12" />
        <path d="M19 18h10c3 0 5 2 5 5v7c0 3-2 5-5 5h-8c-3 0-5-2-5-5v-4" />
      </svg>
    );
  }
  if (icon === "pancreas") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M8 28c8-10 19-13 32-6-4 9-13 13-24 11-4-1-6-2-8-5Z" />
        <path d="M22 24c5 0 9 1 13 4" />
      </svg>
    );
  }
  if (icon === "kidney") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M18 10c-6 2-9 8-8 16 1 8 5 13 10 12 4-1 4-6 2-11-2-6 2-10 2-14-1-2-3-4-6-3Z" />
        <path d="M30 10c6 2 9 8 8 16-1 8-5 13-10 12-4-1-4-6-2-11 2-6-2-10-2-14 1-2 3-4 6-3Z" />
      </svg>
    );
  }
  if (icon === "ovarian") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M15 29c2-7 6-11 9-11s7 4 9 11" />
        <circle cx="13" cy="32" r="5" />
        <circle cx="35" cy="32" r="5" />
      </svg>
    );
  }
  if (icon === "bladder") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M17 14c1 7-4 11-4 18 0 6 5 10 11 10s11-4 11-10c0-7-5-11-4-18" />
        <path d="M20 14h8" />
      </svg>
    );
  }
  if (icon === "thyroid") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 12v24" />
        <path d="M21 22c-7-5-12-2-12 5 0 5 3 8 8 8 4 0 6-3 7-7" />
        <path d="M27 22c7-5 12-2 12 5 0 5-3 8-8 8-4 0-6-3-7-7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M14 28c-4-8 2-18 10-18s14 10 10 18c-2 5-6 8-10 8s-8-3-10-8Z" />
      <path d="M18 21h12" />
      <path d="M20 27h8" />
    </svg>
  );
}

export function VafAnalysisPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryGene = (searchParams.get("gene") ?? DEFAULT_GENE).trim() || DEFAULT_GENE;
  const [geneInput, setGeneInput] = useState(queryGene);

  useEffect(() => {
    setGeneInput(queryGene);
  }, [queryGene]);

  const vafQ = useQuery({
    queryKey: ["vaf-bodymap", queryGene],
    queryFn: () => getVafBodyMap(queryGene),
    staleTime: 5 * 60_000,
  });

  const entries = vafQ.data?.entries ?? [];
  const maxMean = vafQ.data?.maxMeanVaf ?? 0;
  const organEntries = useMemo(() => buildOrganEntryMap(entries), [entries]);
  const totalRecords = entries.reduce((sum, entry) => sum + entry.recordCount, 0);
  const totalSamples = entries.reduce((sum, entry) => sum + entry.sampleCount, 0);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const nextGene = geneInput.trim();
    const next = new URLSearchParams(searchParams);
    if (nextGene) next.set("gene", nextGene);
    else next.delete("gene");
    setSearchParams(next);
  };

  return (
    <div className="page-stack vaf-analysis-page">
      <SectionHeader
        eyebrow="Tools"
        title="VAF Analysis"
        description="Gene-level variant allele frequency across mounted private cfDNA cohorts."
      />

      <section className="detail-card vaf-analysis-shell">
        <div className="vaf-analysis-controls">
          <form className="vaf-analysis-form" onSubmit={submitSearch}>
            <label htmlFor="vaf-gene-input">Gene Symbol</label>
            <div className="vaf-analysis-search-row">
              <input
                id="vaf-gene-input"
                value={geneInput}
                onChange={(event) => setGeneInput(event.target.value)}
                placeholder="ERBB2, TP53, PIK3CA..."
              />
              <button className="button-primary" type="submit">Plot</button>
            </div>
          </form>

          <div className="vaf-analysis-metrics" aria-label="VAF summary">
            <div>
              <span>Gene</span>
              <strong>{vafQ.data?.gene ?? queryGene.toUpperCase()}</strong>
            </div>
            <div>
              <span>Cohorts</span>
              <strong>{entries.length}</strong>
            </div>
            <div>
              <span>Samples</span>
              <strong>{totalSamples}</strong>
            </div>
            <div>
              <span>Records</span>
              <strong>{totalRecords}</strong>
            </div>
          </div>

          <div className="vaf-analysis-legend" aria-label="VAF heat scale">
            <span>Low mean VAF</span>
            <div aria-hidden="true" />
            <span>High mean VAF</span>
          </div>
        </div>

        <div className="vaf-analysis-workspace">
          <div className="vaf-bodymap-panel">
            <div className="vaf-icon-map" aria-label={`${queryGene} VAF organ map`}>
              <div className="vaf-icon-map-core">
                <strong>{vafQ.data?.gene ?? queryGene.toUpperCase()}</strong>
                <span>mean VAF map</span>
              </div>
              {ORGAN_NODES.map((node) => {
                const entry = organEntries.get(node.organKey);
                const active = Boolean(entry);
                const ratio = entry && maxMean > 0 ? Math.max(0.18, entry.meanVaf / maxMean) : 0;
                const style = {
                  "--vaf-node-left": `${node.left}%`,
                  "--vaf-node-top": `${node.top}%`,
                  "--vaf-node-size": `${active ? 50 + ratio * 16 : 46}px`,
                  "--vaf-node-color": active ? markerColor(ratio) : "#9aa8ba",
                } as CSSProperties;
                return (
                  <div
                    key={node.organKey}
                    className={`vaf-organ-node${active ? " vaf-organ-node--active" : ""}`}
                    style={style}
                    title={entry ? `${node.label}: mean VAF ${formatVaf(entry.meanVaf)} (${entry.sampleCount} samples)` : `${node.label}: no data`}
                  >
                    <span className="vaf-organ-icon">
                      <OrganIcon icon={node.icon} />
                    </span>
                    <strong>{entry?.cancerType ?? node.label}</strong>
                    <small>{entry ? formatVaf(entry.meanVaf) : "No data"}</small>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="vaf-analysis-table-wrap">
            {vafQ.isLoading ? (
              <p className="panel-note">Loading VAF data...</p>
            ) : vafQ.isError ? (
              <p className="panel-note">VAF data request failed. Check that the backend is running with the mounted VAF directory.</p>
            ) : entries.length > 0 ? (
              <table className="vaf-analysis-table">
                <thead>
                  <tr>
                    <th>Cohort</th>
                    <th>Mean VAF</th>
                    <th>Median</th>
                    <th>Max</th>
                    <th>Samples</th>
                    <th>Records</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.cohort}>
                      <td>{entry.cancerType}</td>
                      <td>{formatVaf(entry.meanVaf)} <span>{formatPercent(entry.meanVaf)}</span></td>
                      <td>{formatVaf(entry.medianVaf)}</td>
                      <td>{formatVaf(entry.maxVaf)}</td>
                      <td>{entry.sampleCount}</td>
                      <td>{entry.recordCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="panel-note">No mounted gene-level VAF file was found for {queryGene.toUpperCase()}.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
