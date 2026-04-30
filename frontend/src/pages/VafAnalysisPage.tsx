import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { getVafBodyMap } from "../api/client";
import { SectionHeader } from "../components/SectionHeader";
import type { VafBodyMapEntry } from "../types/api";
import humanBodyImg from "../assets/body_simple_nohand.png";

const DEFAULT_GENE = "ERBB2";

type OrganShape = {
  organKey: string;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  rotate?: number;
};

const ORGAN_SHAPES: OrganShape[] = [
  { organKey: "lung", label: "Lung", left: 55.5, top: 27.2, width: 7.4, height: 10.8, rotate: -12 },
  { organKey: "lung", label: "Lung", left: 67.2, top: 27.2, width: 7.4, height: 10.8, rotate: 12 },
  { organKey: "breast", label: "Breast", left: 55.2, top: 36.8, width: 7.8, height: 5.2, rotate: 8 },
  { organKey: "breast", label: "Breast", left: 68.3, top: 36.8, width: 7.8, height: 5.2, rotate: -8 },
  { organKey: "bladder", label: "Bladder", left: 33.2, top: 63.8, width: 5.6, height: 4.4 },
  { organKey: "bladder", label: "Bladder", left: 62.4, top: 63.4, width: 5.6, height: 4.4 },
  { organKey: "liver", label: "Liver", left: 55.2, top: 41.6, width: 13.4, height: 7.2, rotate: -8 },
  { organKey: "gastric", label: "Gastric", left: 67.2, top: 43.8, width: 8.2, height: 5.6, rotate: -18 },
  { organKey: "colorectal", label: "Colorectal", left: 58.2, top: 50.8, width: 14.6, height: 8.8 },
  { organKey: "pancreatic", label: "Pancreatic", left: 62.4, top: 44.6, width: 8.2, height: 2.8, rotate: -8 },
  { organKey: "kidney", label: "Kidney", left: 54.4, top: 47.8, width: 4.6, height: 5.6, rotate: 10 },
  { organKey: "kidney", label: "Kidney", left: 72.3, top: 47.8, width: 4.6, height: 5.6, rotate: -10 },
  { organKey: "ovarian", label: "Ovarian", left: 58.3, top: 61.2, width: 3.8, height: 3.6 },
  { organKey: "ovarian", label: "Ovarian", left: 68.8, top: 61.2, width: 3.8, height: 3.6 },
  { organKey: "brain", label: "Brain", left: 56.3, top: 4.8, width: 14.4, height: 7.8 },
  { organKey: "thyroid", label: "Thyroid", left: 62.5, top: 22.8, width: 3.8, height: 2.7 },
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
              {ORGAN_SHAPES.map((shape, index) => {
                const entry = organEntries.get(shape.organKey);
                if (!entry) return null;
                const ratio = maxMean > 0 ? Math.max(0.18, entry.meanVaf / maxMean) : 0.18;
                const opacity = Math.min(0.82, 0.18 + ratio * 0.58);
                const style = {
                  "--vaf-left": `${shape.left}%`,
                  "--vaf-top": `${shape.top}%`,
                  "--vaf-width": `${shape.width}%`,
                  "--vaf-height": `${shape.height}%`,
                  "--vaf-rotate": `${shape.rotate ?? 0}deg`,
                  "--vaf-opacity": opacity,
                } as CSSProperties;
                return (
                  <span
                    key={`${shape.organKey}-${index}`}
                    className="vaf-bodymap-spot"
                    style={style}
                    title={`${shape.label}: mean VAF ${formatVaf(entry.meanVaf)} (${entry.sampleCount} samples)`}
                  />
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
