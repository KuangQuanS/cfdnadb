import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { getFilters, getRecords } from "../api/client";
import { DataTable } from "../components/DataTable";
import { SectionHeader } from "../components/SectionHeader";
import type { BiomarkerRecord } from "../types/api";
import { formatNumber } from "../utils/format";

const columnHelper = createColumnHelper<BiomarkerRecord>();

export function BrowsePage() {
  const [keyword, setKeyword] = useState("");
  const [diseaseType, setDiseaseType] = useState("");
  const [technology, setTechnology] = useState("");
  const [markerType, setMarkerType] = useState("");
  const [publicationYear, setPublicationYear] = useState("");
  const [page, setPage] = useState(0);

  const filtersQuery = useQuery({ queryKey: ["filters"], queryFn: getFilters });

  useEffect(() => {
    setPage(0);
  }, [keyword, diseaseType, technology, markerType, publicationYear]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("size", "10");
    if (keyword) params.set("keyword", keyword);
    if (diseaseType) params.set("diseaseType", diseaseType);
    if (technology) params.set("technology", technology);
    if (markerType) params.set("markerType", markerType);
    if (publicationYear) params.set("publicationYear", publicationYear);
    return `?${params.toString()}`;
  }, [keyword, diseaseType, technology, markerType, publicationYear, page]);

  const recordsQuery = useQuery({
    queryKey: ["records", queryString],
    queryFn: () => getRecords(queryString)
  });

  const columns = useMemo<ColumnDef<BiomarkerRecord>[]>(() => [
    columnHelper.accessor("markerName", {
      header: "Marker",
      cell: (info) => <strong>{info.getValue()}</strong>
    }),
    columnHelper.accessor("markerType", { header: "Type" }),
    columnHelper.accessor("diseaseType", { header: "Disease" }),
    columnHelper.accessor("specimenType", { header: "Specimen" }),
    columnHelper.accessor("significanceValue", {
      header: "Value",
      cell: (info) => (info.getValue() !== null ? Number(info.getValue()).toFixed(3) : "-")
    }),
    columnHelper.accessor("studyAccession", {
      header: "Study",
      cell: (info) => <Link to={`/studies/${info.row.original.studyId}`}>{info.getValue()}</Link>
    }),
    columnHelper.accessor("publicationYear", { header: "Year" })
  ], []);

  const exportCsv = () => {
    const rows = recordsQuery.data?.content ?? [];
    const header = ["marker", "marker_type", "disease", "study", "year"];
    const body = rows.map((row) => [row.markerName, row.markerType, row.diseaseType, row.studyAccession, row.publicationYear ?? ""]);
    const csv = [header, ...body].map((line) => line.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cfdna_browse_export.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-stack">
      <SectionHeader
        eyebrow="Browse"
        title="Search biomarker-level records"
        description="Filter by disease, assay technology, marker class and publication year, then jump to the linked study page."
      />

      <section className="filter-panel">
        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Search marker, accession or title" />
        <select value={diseaseType} onChange={(event) => setDiseaseType(event.target.value)}>
          <option value="">All diseases</option>
          {filtersQuery.data?.diseaseTypes.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={technology} onChange={(event) => setTechnology(event.target.value)}>
          <option value="">All technologies</option>
          {filtersQuery.data?.technologies.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={markerType} onChange={(event) => setMarkerType(event.target.value)}>
          <option value="">All marker types</option>
          {filtersQuery.data?.markerTypes.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={publicationYear} onChange={(event) => setPublicationYear(event.target.value)}>
          <option value="">All years</option>
          {filtersQuery.data?.publicationYears.map((item) => <option key={item} value={String(item)}>{item}</option>)}
        </select>
        <button className="button-secondary" onClick={exportCsv}>Export current rows</button>
      </section>

      <div className="table-meta">
        <span>{formatNumber(recordsQuery.data?.totalElements ?? 0)} matching records</span>
      </div>

      {recordsQuery.data ? <DataTable data={recordsQuery.data.content} columns={columns} /> : <p className="panel-note">Loading records...</p>}

      <div className="pagination-bar">
        <button className="button-secondary" disabled={recordsQuery.data?.first ?? true} onClick={() => setPage((current) => Math.max(current - 1, 0))}>Previous</button>
        <span>Page {(recordsQuery.data?.page ?? 0) + 1} / {Math.max(recordsQuery.data?.totalPages ?? 1, 1)}</span>
        <button className="button-secondary" disabled={recordsQuery.data?.last ?? true} onClick={() => setPage((current) => current + 1)}>Next</button>
      </div>
    </div>
  );
}
