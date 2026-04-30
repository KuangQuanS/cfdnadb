import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { getVafBodyMap } from "../api/client";
import { SectionHeader } from "../components/SectionHeader";
import type { VafBodyMapEntry } from "../types/api";

const DEFAULT_GENE = "ERBB2";

type CohortNode = {
  organKey: string;
  label: string;
  code: string;
  left: number;
  top: number;
};

const COHORT_NODES: CohortNode[] = [
  { organKey: "brain", label: "Brain", code: "CNS", left: 50, top: 9 },
  { organKey: "lung", label: "Lung", code: "LUNG", left: 22, top: 20 },
  { organKey: "breast", label: "Breast", code: "BRCA", left: 78, top: 20 },
  { organKey: "thyroid", label: "Thyroid", code: "THYR", left: 90, top: 43 },
  { organKey: "kidney", label: "Kidney", code: "KIDN", left: 84, top: 68 },
  { organKey: "ovarian", label: "Ovarian", code: "OV", left: 64, top: 87 },
  { organKey: "bladder", label: "Bladder", code: "BLCA", left: 36, top: 87 },
  { organKey: "colorectal", label: "Colorectal", code: "CRC", left: 16, top: 68 },
  { organKey: "liver", label: "Liver", code: "LIHC", left: 10, top: 43 },
  { organKey: "gastric", label: "Gastric", code: "GAST", left: 30, top: 57 },
  { organKey: "pancreatic", label: "Pancreatic", code: "PDAC", left: 70, top: 57 },
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
              {COHORT_NODES.map((node) => {
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
                    className={`vaf-cohort-node${active ? " vaf-cohort-node--active" : ""}`}
                    style={style}
                    title={entry ? `${node.label}: mean VAF ${formatVaf(entry.meanVaf)} (${entry.sampleCount} samples)` : `${node.label}: no data`}
                  >
                    <span className="vaf-cohort-code">{node.code}</span>
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
