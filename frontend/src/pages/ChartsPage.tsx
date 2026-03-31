import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { getCancerAssets, getTopGenes, toApiUrl } from "../api/client";
import { ChartCard } from "../components/ChartCard";
import { SectionHeader } from "../components/SectionHeader";
import { CANCER_OPTIONS, DEFAULT_CANCER } from "../constants/cfdna";
import { formatNumber } from "../utils/format";

export function ChartsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const cancer = searchParams.get("cancer") ?? DEFAULT_CANCER;

  const topGenesQuery = useQuery({
    queryKey: ["top-genes", cancer],
    queryFn: () => getTopGenes(cancer, 15)
  });

  const assetsQuery = useQuery({
    queryKey: ["cancer-assets", cancer],
    queryFn: () => getCancerAssets(cancer)
  });

  const changeCancer = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("cancer", value);
    setSearchParams(params);
  };

  return (
    <div className="page-stack">
      <SectionHeader
        eyebrow="Mutation Charts"
        title="Top-gene frequencies and PDF previews"
        description="This page is cohort-specific: it reads top mutated genes from aggregate multianno files and lists previewable PDF assets discovered under the server-side Plot and TCGA folders."
      />

      <section className="filter-panel">
        <select value={cancer} onChange={(event) => changeCancer(event.target.value)}>
          {CANCER_OPTIONS.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </section>

      {topGenesQuery.isLoading ? <p className="panel-note">Loading top genes...</p> : null}
      {topGenesQuery.isError ? <p className="panel-note">Top-gene frequencies are unavailable for this cohort.</p> : null}
      {topGenesQuery.data && topGenesQuery.data.length > 0 ? (
        <ChartCard
          title={`${cancer} top mutated genes`}
          option={{
            grid: { left: 48, right: 24, top: 24, bottom: 56 },
            tooltip: { trigger: "axis" },
            xAxis: {
              type: "category",
              axisLabel: { rotate: 35 },
              data: topGenesQuery.data.map((item) => item.gene)
            },
            yAxis: { type: "value", name: "Variants" },
            series: [
              {
                type: "bar",
                data: topGenesQuery.data.map((item) => item.count),
                itemStyle: { color: "#FC812F" }
              }
            ]
          }}
        />
      ) : null}
      {topGenesQuery.data && topGenesQuery.data.length === 0 ? (
        <section className="detail-card empty-card">
          <h3>No top-gene chart available</h3>
          <p>The aggregate multianno file for {cancer} has not been generated yet, so the cohort chart is currently unavailable.</p>
        </section>
      ) : null}

      <section className="page-stack compact-gap">
        <SectionHeader
          eyebrow="PDF assets"
          title="Plot and TCGA previews"
          description="Only discoverable PDF files are listed. The page uses safe API URLs and never exposes the underlying server path."
        />

        {assetsQuery.isLoading ? <p className="panel-note">Loading PDF assets...</p> : null}
        {assetsQuery.isError ? <p className="panel-note">PDF previews are unavailable for this cohort.</p> : null}

        {assetsQuery.data && assetsQuery.data.length > 0 ? (
          <div className="pdf-grid">
            {assetsQuery.data.map((asset) => (
              <article key={`${asset.category}-${asset.fileName}`} className="detail-card pdf-card">
                <div className="dataset-card-header">
                  <div>
                    <p className="section-eyebrow">{asset.category}</p>
                    <h3>{asset.title}</h3>
                  </div>
                  <span className="status-chip success">{formatNumber(asset.sizeBytes)} B</span>
                </div>
                <iframe className="pdf-frame" src={toApiUrl(asset.assetUrl)} title={asset.title} />
                <a className="button-secondary inline-button" href={toApiUrl(asset.assetUrl)} target="_blank" rel="noreferrer">
                  Open PDF
                </a>
              </article>
            ))}
          </div>
        ) : null}

        {assetsQuery.data && assetsQuery.data.length === 0 ? (
          <section className="detail-card empty-card">
            <h3>No PDF previews available</h3>
            <p>{cancer} currently has no discoverable Plot or TCGA PDF files under the server-side cfDNA directory.</p>
          </section>
        ) : null}
      </section>
    </div>
  );
}
