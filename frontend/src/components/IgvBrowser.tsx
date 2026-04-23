import { useEffect, useRef, useState } from "react";
import igv from "igv";
import type { MafMutation } from "../types/api";
import { formatCohortLabel } from "../utils/cohortLabels";

/** Variant classification → display color */
const CLASS_COLORS: Record<string, string> = {
  Missense_Mutation: "#2980b9",
  Nonsense_Mutation: "#e74c3c",
  Frame_Shift_Del: "#8e44ad",
  Frame_Shift_Ins: "#9b59b6",
  In_Frame_Del: "#e67e22",
  In_Frame_Ins: "#f39c12",
  Splice_Site: "#27ae60",
  Silent: "#bdc3c7",
  "3'UTR": "#95a5a6",
  "5'UTR": "#7f8c8d",
};

const DEFAULT_COLOR = "#34495e";

interface IgvBrowserProps {
  gene: string;
  mutations: MafMutation[];
  cancerTypes?: string[];
  onLocusClick?: (chr: string, start: number, end: number) => void;
}

function buildLocus(mutations: MafMutation[]): string {
  if (mutations.length === 0) return "chr1:1-1000";
  const chr = mutations[0].chromosome.startsWith("chr") ? mutations[0].chromosome : `chr${mutations[0].chromosome}`;
  const positions = mutations.map((m) => Number(m.startPosition)).filter((n) => !isNaN(n));
  if (positions.length === 0) return `${chr}:1-1000`;
  const min = Math.min(...positions);
  const max = Math.max(...positions);
  const pad = Math.max(500, Math.round((max - min) * 0.1));
  return `${chr}:${Math.max(1, min - pad)}-${max + pad}`;
}

function mutationsToVariantFeatures(mutations: MafMutation[]) {
  return mutations.map((m, idx) => {
    const chr = m.chromosome.startsWith("chr") ? m.chromosome : `chr${m.chromosome}`;
    const start = Number(m.startPosition) - 1; // 0-based for igv
    const end = Number(m.endPosition) || start + 1;
    const baseChange = (m.referenceAllele && m.tumorSeqAllele2 && m.referenceAllele !== m.tumorSeqAllele2)
      ? `${m.referenceAllele}>${m.tumorSeqAllele2}`
      : null;
    const nameParts = [m.hugoSymbol];
    if (m.aaChange) nameParts.push(m.aaChange);
    if (baseChange) nameParts.push(baseChange);
    if (!m.aaChange) nameParts.push(m.variantClassification.replace(/_/g, " "));
    return {
      chr,
      start,
      end,
      name: nameParts.join(" | "),
      type: m.variantClassification,
      color: CLASS_COLORS[m.variantClassification] || DEFAULT_COLOR,
      sampleBarcode: m.tumorSampleBarcode,
      cancerType: m.cancerType,
      refAllele: m.referenceAllele,
      altAllele: m.tumorSeqAllele2,
      variantClass: m.variantClassification,
      variantType: m.variantType,
      aaChange: m.aaChange || "-",
      exon: m.exon || "-",
      id: idx,
    };
  });
}

function groupByCancer(mutations: MafMutation[]): Map<string, MafMutation[]> {
  const map = new Map<string, MafMutation[]>();
  for (const m of mutations) {
    const key = m.cancerType || "Unknown";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return map;
}

export function IgvBrowser({ gene, mutations, onLocusClick }: IgvBrowserProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const browserRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mutations.length === 0) return;

    let cancelled = false;

    const locus = buildLocus(mutations);
    const byCancer = groupByCancer(mutations);

    const tracks: any[] = [];

    for (const [cancer, muts] of byCancer) {
      const features = mutationsToVariantFeatures(muts);
      tracks.push({
        name: `${formatCohortLabel(cancer)} (${muts.length})`,
        type: "annotation",
        displayMode: "EXPANDED",
        height: 80,
        minHeight: 40,
        features,
        color: (feature: any) => feature.color || DEFAULT_COLOR,
        onClick: (featureList: any[]) => {
          if (!featureList?.length || !onLocusClick) return;
          const f = featureList[0];
          onLocusClick(f.chr, f.start + 1, f.end);
        },
      });
    }

    const opts = {
      genome: "hg38",
      locus,
      tracks,
      showControls: true,
      showNavigation: true,
      showCenterGuide: true,
    };

    (async () => {
      try {
        if (browserRef.current) {
          igv.removeBrowser(browserRef.current);
          browserRef.current = null;
        }
        el.innerHTML = "";

        const browser = await igv.createBrowser(el, opts);
        if (cancelled) {
          igv.removeBrowser(browser);
          return;
        }
        browserRef.current = browser;
        setIsReady(true);
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          console.error("IGV init error:", e);
          setError(e?.message || "Failed to load genome browser");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (browserRef.current) {
        try {
          igv.removeBrowser(browserRef.current);
        } catch {
          // ignore cleanup errors
        }
        browserRef.current = null;
      }
    };
  }, [gene, mutations, onLocusClick]);

  if (mutations.length === 0) {
    return (
      <div className="igv-empty">
        No mutations to display in the genome browser.
      </div>
    );
  }

  return (
    <div className="igv-wrapper">
      <div className="igv-legend">
        {Object.entries(CLASS_COLORS).map(([cls, color]) => (
          <span key={cls} className="igv-legend-item">
            <span className="igv-legend-dot" style={{ background: color }} />
            {cls.replace(/_/g, " ")}
          </span>
        ))}
      </div>
      {error ? (
        <div className="igv-error">
          <p>Genome browser failed to load: {error}</p>
        </div>
      ) : null}
      {!isReady && !error ? (
        <p className="igv-loading">Loading genome browser...</p>
      ) : null}
      <div ref={containerRef} className="igv-container" />
    </div>
  );
}
