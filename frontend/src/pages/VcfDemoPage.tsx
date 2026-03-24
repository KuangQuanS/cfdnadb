import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { getVcfDemo } from "../api/client";
import { ChartCard } from "../components/ChartCard";
import { DataTable } from "../components/DataTable";
import { SectionHeader } from "../components/SectionHeader";
import { StatGrid } from "../components/StatGrid";
import type { VcfVariantRecord } from "../types/api";
import { formatNumber } from "../utils/format";

const columnHelper = createColumnHelper<VcfVariantRecord>();

export function VcfDemoPage() {
  const demoQuery = useQuery({ queryKey: ["vcf-demo"], queryFn: getVcfDemo });
  const demo = demoQuery.data;

  const columns = useMemo<ColumnDef<VcfVariantRecord>[]>(() => [
    columnHelper.accessor("datasetKey", { header: "Dataset" }),
    columnHelper.accessor("sampleId", { header: "Sample" }),
    columnHelper.accessor("gene", {
      header: "Gene",
      cell: (info) => <strong>{info.getValue()}</strong>
    }),
    columnHelper.accessor("chromosome", { header: "Chr" }),
    columnHelper.accessor("position", { header: "Pos" }),
    columnHelper.accessor("variantType", { header: "Type" }),
    columnHelper.accessor("proteinChange", {
      header: "Protein",
      cell: (info) => info.getValue() ?? "-"
    }),
    columnHelper.accessor("vaf", {
      header: "VAF",
      cell: (info) => (info.getValue() !== null ? `${(Number(info.getValue()) * 100).toFixed(1)}%` : "-")
    }),
    columnHelper.accessor("filterStatus", { header: "Filter" })
  ], []);

  return (
    <div className="page-stack">
      <SectionHeader
        eyebrow="VCF Demo"
        title="Public-facing VCF dataset placeholder"
        description="A frontend-only placeholder that shows how VCF-based releases, parser states and normalized variant records could be presented without exposing internal storage details."
      />

      <section className="detail-card callout-card">
        <p className="section-eyebrow">Public presentation rule</p>
        <p>
          This demo intentionally shows dataset keys, release identifiers and public status notes only. Internal server paths, mount points and storage layout should remain hidden from public users.
        </p>
      </section>

      <StatGrid
        items={[
          { label: "Dataset releases", value: formatNumber(demo?.totalDatasetFolders ?? 0) },
          { label: "VCF files", value: formatNumber(demo?.totalVcfFiles ?? 0) },
          { label: "Samples", value: formatNumber(demo?.totalSamples ?? 0) },
          { label: "Parsed variants", value: formatNumber(demo?.parsedVariantCount ?? 0) }
        ]}
      />

      {demo ? (
        <div className="chart-grid two-up">
          <ChartCard
            title="Disease coverage"
            option={{
              tooltip: { trigger: "item" },
              series: [
                {
                  type: "pie",
                  radius: ["45%", "70%"],
                  label: { formatter: "{b}: {c}" },
                  data: demo.diseaseDistribution.map((item) => ({ name: item.label, value: item.count }))
                }
              ]
            }}
          />
          <ChartCard
            title="Sample source coverage"
            option={{
              tooltip: { trigger: "axis" },
              xAxis: { type: "category", data: demo.sampleSourceDistribution.map((item) => item.label) },
              yAxis: { type: "value" },
              series: [
                {
                  type: "bar",
                  data: demo.sampleSourceDistribution.map((item) => item.count),
                  itemStyle: { color: "#0284C7" }
                }
              ]
            }}
          />
        </div>
      ) : null}

      <section className="page-stack compact-gap">
        <SectionHeader
          eyebrow="Releases"
          title="Recognized public dataset manifests"
          description="These cards stand in for future public release pages backed by private server-side storage and import jobs."
        />
        <div className="dataset-card-grid">
          {demo?.datasetFolders.map((dataset) => (
            <article key={dataset.datasetKey} className="detail-card dataset-card">
              <div className="dataset-card-header">
                <div>
                  <p className="section-eyebrow">{dataset.datasetKey}</p>
                  <h3>{dataset.displayName}</h3>
                </div>
                <span className="status-chip">{dataset.parserStatus}</span>
              </div>
              <dl className="dataset-metadata-list">
                <div><dt>Release ID</dt><dd><code>{dataset.publicReleaseId}</code></dd></div>
                <div><dt>Disease</dt><dd>{dataset.diseaseType}</dd></div>
                <div><dt>Sample source</dt><dd>{dataset.sampleSource}</dd></div>
                <div><dt>Platform</dt><dd>{dataset.platform}</dd></div>
                <div><dt>Reference</dt><dd>{dataset.referenceBuild}</dd></div>
                <div><dt>Publication</dt><dd>{dataset.publication}</dd></div>
                <div><dt>Counts</dt><dd>{dataset.sampleCount} samples, {dataset.vcfFileCount} VCF files, {dataset.parsedVariantCount} parsed rows</dd></div>
                <div><dt>Public note</dt><dd>{dataset.nextAction}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="page-stack compact-gap">
        <SectionHeader
          eyebrow="Pipeline"
          title="Proposed ingestion flow"
          description="The public portal can stay stable while the backend importer evolves from release registration to full annotation."
        />
        <div className="pipeline-list">
          {demo?.pipelineSteps.map((step) => (
            <article key={step.step} className="detail-card pipeline-card">
              <div className="pipeline-step">{step.step}</div>
              <div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                <p className="pipeline-output">Output: <code>{step.output}</code></p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="page-stack compact-gap">
        <SectionHeader
          eyebrow="Variants"
          title="Example normalized VCF records"
          description="These rows are placeholders for the public variant browser you would expose after parsing per-sample VCF and annotation fields."
        />
        {demo ? <DataTable data={demo.exampleVariants} columns={columns} /> : <p className="panel-note">Loading VCF placeholder data...</p>}
      </section>
    </div>
  );
}
