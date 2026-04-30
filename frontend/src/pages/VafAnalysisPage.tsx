import { Fragment, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { getVafBodyMap } from "../api/client";
import { SectionHeader } from "../components/SectionHeader";
import type { VafBodyMapEntry } from "../types/api";
import humanBodyImg from "../assets/body_simple_nohand.png";

const DEFAULT_GENE = "ERBB2";

type OrganMarker = {
  organKey: string;
  label: string;
  left: number;
  top: number;
  labelLeft: number;
  labelTop: number;
  align?: "left" | "right";
};

const ORGAN_MARKERS: OrganMarker[] = [
  { organKey: "brain", label: "Brain", left: 62.4, top: 7.2, labelLeft: 76, labelTop: 7.2 },
  { organKey: "thyroid", label: "Thyroid", left: 63.7, top: 23.6, labelLeft: 76, labelTop: 23.4 },
  { organKey: "lung", label: "Lung", left: 63.8, top: 31.2, labelLeft: 76, labelTop: 30.8 },
  { organKey: "breast", label: "Breast", left: 63.4, top: 37.6, labelLeft: 76, labelTop: 37.2 },
  { organKey: "liver", label: "Liver", left: 59.4, top: 43.6, labelLeft: 40, labelTop: 43.2, align: "right" },
  { organKey: "gastric", label: "Gastric", left: 69.4, top: 45.4, labelLeft: 78, labelTop: 45.2 },
  { organKey: "pancreatic", label: "Pancreatic", left: 65.4, top: 46.4, labelLeft: 78, labelTop: 50.4 },
  { organKey: "kidney", label: "Kidney", left: 55.8, top: 49.8, labelLeft: 39, labelTop: 49.6, align: "right" },
  { organKey: "colorectal", label: "Colorectal", left: 64.2, top: 54.6, labelLeft: 78, labelTop: 56.2 },
  { organKey: "ovarian", label: "Ovarian", left: 63.8, top: 62.4, labelLeft: 78, labelTop: 63 },
  { organKey: "bladder", label: "Bladder", left: 47.8, top: 64.2, labelLeft: 34, labelTop: 65.4, align: "right" },
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
            <div className="vaf-bodymap-canvas" aria-label={`${queryGene} VAF body map`}>
              <img src={humanBodyImg} alt="Human body map for VAF analysis" />
              {ORGAN_MARKERS.map((marker) => {
                const entry = organEntries.get(marker.organKey);
                if (!entry) return null;
                const ratio = maxMean > 0 ? Math.max(0.18, entry.meanVaf / maxMean) : 0.18;
                const style = {
                  "--vaf-left": `${marker.left}%`,
                  "--vaf-top": `${marker.top}%`,
                  "--vaf-label-left": `${marker.labelLeft}%`,
                  "--vaf-label-top": `${marker.labelTop}%`,
                  "--vaf-size": `${14 + ratio * 14}px`,
                  "--vaf-color": markerColor(ratio),
                } as CSSProperties;
                return (
                  <Fragment key={marker.organKey}>
                    <span
                      className="vaf-bodymap-marker"
                      style={style}
                      title={`${marker.label}: mean VAF ${formatVaf(entry.meanVaf)} (${entry.sampleCount} samples)`}
                    />
                    <span
                      className={`vaf-bodymap-label${marker.align === "right" ? " vaf-bodymap-label--right" : ""}`}
                      style={style}
                    >
                      <strong>{entry.cancerType}</strong>
                      <small>{formatVaf(entry.meanVaf)}</small>
                    </span>
                  </Fragment>
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
