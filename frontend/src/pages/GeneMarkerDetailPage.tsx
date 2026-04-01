import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { getMarkerRecord, type MarkerSeriesGroup } from "../data/markerdbMock";
import { formatNumber } from "../utils/format";

const CHROMOSOME_LABELS = [
  "chr1", "chr2", "chr3", "chr4", "chr5", "chr6", "chr7", "chr8",
  "chr9", "chr10", "chr11", "chr12", "chr13", "chr14", "chr15", "chr16",
  "chr17", "chr18", "chr19", "chr20", "chr21", "chr22", "chrX", "chrY"
];

function quantile(values: number[], q: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  const next = sorted[base + 1] ?? sorted[base];
  return sorted[base] + rest * (next - sorted[base]);
}

function summarize(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return [sorted[0], quantile(sorted, 0.25), quantile(sorted, 0.5), quantile(sorted, 0.75), sorted[sorted.length - 1]];
}

function buildProfileOption(title: string, groups: MarkerSeriesGroup[]): EChartsOption {
  return {
    color: groups.map((group) => group.color),
    tooltip: { trigger: "item" },
    grid: { left: 55, right: 25, top: 40, bottom: 60 },
    xAxis: {
      type: "category",
      data: groups.map((group) => group.label),
      axisLabel: { fontSize: 11, rotate: 18 }
    },
    yAxis: {
      type: "value",
      name: "Signal (a.u.)",
      nameTextStyle: { fontSize: 11 }
    },
    series: [
      {
        type: "boxplot",
        data: groups.map((group) => summarize(group.values)),
        itemStyle: {
          borderColor: "#4f6ba8",
          color: "rgba(127, 161, 236, 0.45)"
        }
      }
    ],
    title: {
      text: title,
      left: "center",
      textStyle: { fontSize: 14, fontWeight: 700, color: "#1f2d4a" }
    }
  };
}

function buildComparisonOption(groups: MarkerSeriesGroup[]): EChartsOption {
  return {
    color: groups.map((group) => group.color),
    tooltip: { trigger: "item" },
    grid: { left: 60, right: 30, top: 28, bottom: 80 },
    xAxis: {
      type: "category",
      data: groups.map((group) => group.label),
      axisLabel: { rotate: 42, fontSize: 11 }
    },
    yAxis: {
      type: "value",
      name: "Signal (a.u.)",
      nameTextStyle: { fontSize: 11 }
    },
    series: [
      {
        type: "boxplot",
        data: groups.map((group) => summarize(group.values)),
        itemStyle: {
          borderColor: "#5a6985",
          color: "rgba(114, 135, 175, 0.45)"
        }
      },
      ...groups.map((group, groupIndex) => ({
        type: "scatter" as const,
        data: group.values.map((value, valueIndex) => [groupIndex, Number((value + (valueIndex % 5) * 0.14 - 0.28).toFixed(2))]),
        symbolSize: 7,
        itemStyle: { color: group.color, opacity: 0.8 }
      }))
    ]
  };
}

export function GeneMarkerDetailPage() {
  const { markerDbId = "" } = useParams();
  const detailQuery = useQuery({
    queryKey: ["markerdb-detail", markerDbId],
    queryFn: () => getMarkerRecord(markerDbId),
    enabled: markerDbId.length > 0
  });

  const detail = detailQuery.data;
  const [selection, setSelection] = useState({
    omics: "",
    featureType: "",
    collection: "",
    specimen: "",
    element: ""
  });
  const [confirmedSelection, setConfirmedSelection] = useState(selection);
  const [selectedFeature, setSelectedFeature] = useState("");
  const [selectedChromosome, setSelectedChromosome] = useState("");

  useEffect(() => {
    if (!detail) return;
    const next = {
      omics: detail.selectedOmics,
      featureType: detail.selectedFeatureType,
      collection: detail.selectedCollection,
      specimen: detail.selectedSpecimen,
      element: detail.selectedElement
    };
    setSelection(next);
    setConfirmedSelection(next);
    setSelectedFeature(detail.selectedFeature);
    setSelectedChromosome(detail.selectedChromosome);
  }, [detail]);

  const comparisonGroups = useMemo(() => detail?.comparisonGroups ?? [], [detail]);

  if (detailQuery.isLoading) {
    return <p className="panel-note">Loading marker card...</p>;
  }

  if (detailQuery.isError || !detail) {
    return (
      <section className="detail-card empty-card">
        <h3>Marker card unavailable</h3>
        <p>The requested MarkerDB entry could not be found in the current placeholder collection.</p>
      </section>
    );
  }

  return (
    <div className="page-stack markerdb-detail-page">
      <section className="markerdb-detail-title">
        <div>
          <p>
            Showing biomarker card for <strong>{detail.record.variantName}</strong> in <strong>{detail.record.geneName}</strong>
          </p>
          <span className="markerdb-detail-subline">
            <Link to="/gene-search">Back to browsing biomarkers</Link>
          </span>
        </div>
      </section>

      <section className="detail-card markerdb-jumpbar">
        <strong>Jump To Section:</strong>
        <div className="markerdb-jump-links">
          <a href="#marker-conditions">Conditions</a>
          <a href="#marker-identification">Identification</a>
          <a href="#marker-analysis">Analysis</a>
          <a href="#marker-locus">DNA Locus</a>
          <a href="#marker-related">Related</a>
        </div>
      </section>

      <DetailSection id="marker-record" title="Record Information">
        <DetailTable
          rows={[
            ["Version", detail.version],
            ["Created at", detail.createdAt],
            ["Updated at", detail.updatedAt],
            ["MarkerDB ID", detail.record.markerDbId]
          ]}
        />
      </DetailSection>

      <DetailSection id="marker-conditions" title="Conditions">
        <DetailTable
          rows={[
            ["Associated conditions", detail.record.associatedConditions.join(", ")],
            ["Condition hierarchy", detail.conditionsHierarchy.join(" > ")],
            ["Cancer cohort", detail.record.cancer === "Colonrector" ? "Colorectal" : detail.record.cancer]
          ]}
        />
      </DetailSection>

      <DetailSection id="marker-identification" title="Sequence Variant Identification">
        <DetailTable
          rows={[
            ["Sequence Variant", detail.record.variantName],
            ["Target gene", `${detail.record.geneName} (${detail.record.geneSymbol})`],
            ["Genome location (hg38)", detail.record.genomeLocation],
            ["Description", detail.record.description],
            ["Organism", detail.organism]
          ]}
        />
      </DetailSection>

      <section className="detail-card markerdb-basic-card">
        <div className="markerdb-basic-card-title">Basic Information</div>
        <div className="markerdb-basic-grid">
          <InfoPair label="HGNC Symbol" value={detail.record.geneSymbol} />
          <InfoPair label="NCBI" value={<a href={detail.links[0].url} target="_blank" rel="noreferrer">{detail.links[0].label}</a>} />
          <InfoPair label="Ensembl Id" value={detail.record.ensemblId} />
          <InfoPair label="Gene Biotype" value={detail.record.geneBiotype} />
          <InfoPair label="Genome Location (hg38)" value={detail.record.genomeLocation} />
          <InfoPair label="Specimen" value={detail.record.specimen} />
        </div>
      </section>

      <section className="detail-card markerdb-analysis-card" id="marker-analysis">
        <div className="markerdb-basic-card-title">Analysis</div>
        <div className="markerdb-note-box">
          <strong>Notes:</strong>
          <p>Explore gene data statistics across omics, feature types, collections, specimen sources, and elements. Select options and confirm to refresh the analysis view.</p>
        </div>

        <div className="markerdb-selection-board">
          <SelectionColumn title="Omics" options={detail.omicsOptions} value={selection.omics} onSelect={(value) => setSelection((current) => ({ ...current, omics: value }))} />
          <SelectionColumn title="Feature Type" options={detail.featureTypeOptions} value={selection.featureType} onSelect={(value) => setSelection((current) => ({ ...current, featureType: value }))} />
          <SelectionColumn title="Collection" options={detail.collectionOptions} value={selection.collection} onSelect={(value) => setSelection((current) => ({ ...current, collection: value }))} />
          <SelectionColumn title="Specimen" options={detail.specimenOptions} value={selection.specimen} onSelect={(value) => setSelection((current) => ({ ...current, specimen: value }))} />
          <SelectionColumn title="Element" options={detail.elementOptions} value={selection.element} onSelect={(value) => setSelection((current) => ({ ...current, element: value }))} />
        </div>

        <div className="markerdb-confirm-row">
          <button className="button-secondary" type="button" onClick={() => setConfirmedSelection(selection)}>Confirm</button>
        </div>

        <div className="markerdb-note-box markerdb-note-box-soft">
          <strong>IMPORTANT:</strong>
          <p>The charts below use the current confirmed options: {confirmedSelection.omics} / {confirmedSelection.featureType} / {confirmedSelection.collection} / {confirmedSelection.specimen} / {confirmedSelection.element}.</p>
        </div>

        <div className="markerdb-chart-section">
          <h3>{confirmedSelection.featureType} Profile</h3>
          <div className="markerdb-note-box">
            <strong>Notes:</strong>
            <p>Shown here are profile distributions for the selected gene across representative disease conditions in the selected collection.</p>
          </div>
          <p className="markerdb-breadcrumb">
            {confirmedSelection.omics} / {confirmedSelection.featureType} / {confirmedSelection.collection} / {confirmedSelection.specimen} / {confirmedSelection.element}
          </p>
          <ReactECharts option={buildProfileOption(`${detail.record.geneSymbol} profile`, detail.profileGroups)} style={{ height: 390 }} />
        </div>

        <div className="markerdb-chart-section">
          <h3>{confirmedSelection.featureType} Comparison</h3>
          <div className="markerdb-note-box">
            <strong>Notes:</strong>
            <p>Using a Mann-Whitney-like comparison placeholder, this module contrasts two representative disease groups for the selected biomarker profile.</p>
          </div>
          <div className="markerdb-compare-form">
            <label>
              Disease 1
              <select value={comparisonGroups[0]?.label ?? ""} disabled>
                {comparisonGroups.map((group) => <option key={group.label}>{group.label}</option>)}
              </select>
            </label>
            <label>
              Disease 2
              <select value={comparisonGroups[1]?.label ?? ""} disabled>
                {comparisonGroups.map((group) => <option key={group.label}>{group.label}</option>)}
              </select>
            </label>
            <button className="button-secondary" type="button" disabled>Draw</button>
          </div>
          <ReactECharts option={buildComparisonOption(comparisonGroups)} style={{ height: 360 }} />
        </div>
      </section>

      <section className="detail-card markerdb-track-card" id="marker-locus">
        <div className="markerdb-basic-card-title">DNA Locus Browser</div>
        <div className="markerdb-note-box">
          <strong>Notes:</strong>
          <p>You can select tracks from the feature list and inspect chromosome-wide signal placement for the current biomarker card.</p>
        </div>

        <div className="markerdb-track-shell">
          <aside className="markerdb-track-sidebar">
            <div className="markerdb-track-sidebar-title">Feature</div>
            {detail.trackFeatures.map((feature) => (
              <button
                key={feature}
                type="button"
                className={`markerdb-track-item${feature === selectedFeature ? " active" : ""}`}
                onClick={() => setSelectedFeature(feature)}
              >
                {feature}
              </button>
            ))}

            <div className="markerdb-track-sidebar-title">Tracks</div>
            <div className="markerdb-track-empty">Please select</div>
          </aside>

          <div className="markerdb-track-main">
            <div className="markerdb-track-controls">
              <div className="markerdb-track-left">
                <strong>IGV</strong>
                <span>hg38</span>
                <select value={selectedChromosome} onChange={(event) => setSelectedChromosome(event.target.value)}>
                  {CHROMOSOME_LABELS.map((chromosome) => <option key={chromosome} value={chromosome}>{chromosome}</option>)}
                </select>
                <input value={detail.record.geneSymbol} readOnly />
              </div>
              <div className="markerdb-track-right">
                <button type="button">Cursor Guide</button>
                <button type="button" className="active">Track Labels</button>
                <button type="button">Save SVG</button>
              </div>
            </div>

            <div className="markerdb-chromosome-strip">
              {CHROMOSOME_LABELS.map((chromosome) => (
                <button
                  key={chromosome}
                  type="button"
                  className={chromosome === selectedChromosome ? "active" : ""}
                  onClick={() => setSelectedChromosome(chromosome)}
                >
                  {chromosome.replace("chr", "")}
                </button>
              ))}
            </div>

            <div className="markerdb-track-lanes">
              {detail.trackLanes.map((lane) => (
                <div key={lane.id} className="markerdb-lane-row">
                  <div className="markerdb-lane-label">{lane.label}</div>
                  <div className="markerdb-lane-segments">
                    {lane.bars.map((bar, index) => {
                      const chromosome = CHROMOSOME_LABELS[index];
                      return (
                        <button
                          key={`${lane.id}-${chromosome}`}
                          type="button"
                          className={`markerdb-lane-segment${chromosome === selectedChromosome ? " active" : ""}`}
                          style={{
                            backgroundImage: "repeating-linear-gradient(90deg, rgba(24, 34, 176, 0.92) 0 2px, transparent 2px 6px)",
                            opacity: Math.min(1, 0.28 + bar / 22)
                          }}
                          onClick={() => setSelectedChromosome(chromosome)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="markerdb-locus-view">
              <div className="markerdb-locus-ruler">
                {Array.from({ length: 10 }, (_, index) => (
                  <span key={index}>{index + 1}</span>
                ))}
              </div>
              <div className="markerdb-locus-track">
                <div className="markerdb-locus-line" />
                <div className="markerdb-locus-marker" style={{ left: "62%" }}>
                  <span>{detail.record.markerDbId}</span>
                </div>
              </div>
              <p className="markerdb-locus-caption">
                {selectedFeature} on {selectedChromosome} at {detail.record.chromosome}:{formatNumber(detail.record.position)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="detail-card markerdb-related-card" id="marker-related">
        <div className="markerdb-basic-card-title">Related Biomarkers</div>
        {detail.relatedMarkers.length === 0 ? (
          <div className="markerdb-related-empty">No biomarker related to gene {detail.record.geneSymbol} was found in the current collection.</div>
        ) : (
          <div className="markerdb-related-links">
            {detail.relatedMarkers.map((markerId) => (
              <Link key={markerId} to={`/gene-search/${markerId}`}>{markerId}</Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DetailSection({
  id,
  title,
  children
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="detail-card markerdb-detail-section" id={id}>
      <div className="markerdb-section-title">{title}</div>
      {children}
    </section>
  );
}

function DetailTable({
  rows
}: {
  rows: [string, ReactNode][];
}) {
  return (
    <table className="markerdb-detail-table">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <th>{label}</th>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InfoPair({
  label,
  value
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="markerdb-info-pair">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SelectionColumn({
  title,
  options,
  value,
  onSelect
}: {
  title: string;
  options: string[];
  value: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="markerdb-selection-column">
      <h4>{title}</h4>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={`markerdb-selection-option${option === value ? " active" : ""}`}
          onClick={() => onSelect(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
