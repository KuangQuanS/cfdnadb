import type {
  ApiResponse,
  DatabaseStats,
  DataFile,
  DownloadAsset,
  FilterOptions,
  LabelCount,
  Overview,
  PagedResponse,
  BiomarkerRecord,
  StudyDetail,
  VisualizationSummary,
  VcfDemo,
  CancerAsset,
  CancerSummary,
  GeneVariant,
  GeneSummary,
  TopGene
} from "../types/api";
import {
  downloadsMock,
  filtersMock,
  overviewMock,
  recordsMock,
  studyDetailsMock,
  vcfDemoMock,
  visualizationMock,
  cancerSummaryMock,
  funcDistributionMock,
  exonicDistributionMock,
  chromDistributionMock,
  sampleBurdenMock
} from "./mockData";

const derivedBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? (derivedBase === "/" ? "" : derivedBase);

function resolveMock(path: string): unknown {
  if (path.startsWith("/api/v1/overview")) return overviewMock;
  if (path.startsWith("/api/v1/records")) return recordsMock;
  if (path.startsWith("/api/v1/filters")) return filtersMock;
  if (path.startsWith("/api/v1/visualizations/summary")) return visualizationMock;
  if (path.startsWith("/api/v1/vcf-demo")) return vcfDemoMock;
  if (path.startsWith("/api/v1/downloads")) return downloadsMock;
  if (path.startsWith("/api/v1/summary/cancers")) return cancerSummaryMock;
  if (path.startsWith("/api/v1/variants/func-distribution")) return funcDistributionMock;
  if (path.startsWith("/api/v1/variants/exonic-distribution")) return exonicDistributionMock;
  if (path.startsWith("/api/v1/variants/chrom-distribution")) return chromDistributionMock;
  if (path.startsWith("/api/v1/variants/sample-burden")) return sampleBurdenMock;
  if (path.startsWith("/api/v1/studies/")) {
    const id = Number(path.split("/").pop());
    return studyDetailsMock[id] ?? studyDetailsMock[1];
  }
  throw new Error(`No mock response for ${path}`);
}

async function request<T>(path: string): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`);
    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }
    const payload = (await response.json()) as ApiResponse<T>;
    return payload.data;
  } catch {
    return resolveMock(path) as T;
  }
}

async function requestLive<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  const payload = (await response.json()) as ApiResponse<T>;
  return payload.data;
}

export function toApiUrl(path: string) {
  return `${API_BASE}${path}`;
}

export function getOverview() {
  return request<Overview>("/api/v1/overview");
}

export function getRecords(queryString: string) {
  return request<PagedResponse<BiomarkerRecord>>(`/api/v1/records${queryString}`);
}

export function getFilters() {
  return request<FilterOptions>("/api/v1/filters");
}

export function getVisualizationSummary() {
  return request<VisualizationSummary>("/api/v1/visualizations/summary");
}

export function getVcfDemo() {
  return request<VcfDemo>("/api/v1/vcf-demo");
}

export function getDownloads() {
  return request<DownloadAsset[]>("/api/v1/downloads");
}

export function getStudy(id: string) {
  return request<StudyDetail>(`/api/v1/studies/${id}`);
}

export function getCancerSummary() {
  return requestLive<CancerSummary[]>("/api/v1/summary/cancers");
}

export function getTopGenes(cancer: string, limit = 20) {
  const params = new URLSearchParams({ cancer, limit: String(limit) });
  return requestLive<TopGene[]>(`/api/v1/variants/top-genes?${params.toString()}`);
}

export function getGeneVariants(cancer: string, gene: string, page = 1, pageSize = 50) {
  const params = new URLSearchParams({
    cancer,
    gene,
    page: String(page),
    pageSize: String(pageSize)
  });
  return requestLive<PagedResponse<GeneVariant>>(`/api/v1/variants/by-gene?${params.toString()}`);
}

export function getCancerAssets(cancer: string) {
  const params = new URLSearchParams({ cancer });
  return requestLive<CancerAsset[]>(`/api/v1/cancers/assets?${params.toString()}`);
}

export interface BrowseFilters {
  cancer: string;
  gene?: string;
  funcClass?: string;
  exonicFunc?: string;
  chr?: string;
  sample?: string;
  startMin?: number;
  startMax?: number;
  page?: number;
  pageSize?: number;
}

export function browseVariants(filters: BrowseFilters) {
  const params = new URLSearchParams({
    cancer: filters.cancer,
    page: String(filters.page ?? 1),
    pageSize: String(filters.pageSize ?? 25)
  });
  if (filters.gene) params.set("gene", filters.gene);
  if (filters.funcClass) params.set("funcClass", filters.funcClass);
  if (filters.exonicFunc) params.set("exonicFunc", filters.exonicFunc);
  if (filters.chr) params.set("chr", filters.chr);
  if (filters.sample) params.set("sample", filters.sample);
  if (filters.startMin != null) params.set("startMin", String(filters.startMin));
  if (filters.startMax != null) params.set("startMax", String(filters.startMax));
  return requestLive<PagedResponse<GeneVariant>>(`/api/v1/variants/browse?${params.toString()}`);
}

export function getGeneSummary(cancer: string, gene: string) {
  const params = new URLSearchParams({ cancer, gene });
  return requestLive<GeneSummary>(`/api/v1/variants/gene-summary?${params.toString()}`);
}

export function listDataFiles() {
  return requestLive<DataFile[]>("/api/v1/data-files");
}

export function getDatabaseStats() {
  return requestLive<DatabaseStats>("/api/v1/stats");
}

export function getAllGenes(cancer: string) {
  return requestLive<string[]>(`/api/v1/variants/all-genes?cancer=${encodeURIComponent(cancer)}`);
}

export function getGeneSuggestions(cancer: string, q: string) {
  const params = new URLSearchParams({ cancer, q, limit: "10" });
  return requestLive<string[]>(`/api/v1/variants/gene-suggestions?${params.toString()}`);
}

export function getFuncDistribution(cancer: string) {
  const params = new URLSearchParams({ cancer });
  return request<LabelCount[]>(`/api/v1/variants/func-distribution?${params.toString()}`);
}

export function getExonicDistribution(cancer: string) {
  const params = new URLSearchParams({ cancer });
  return request<LabelCount[]>(`/api/v1/variants/exonic-distribution?${params.toString()}`);
}

export function getChromDistribution(cancer: string) {
  const params = new URLSearchParams({ cancer });
  return request<LabelCount[]>(`/api/v1/variants/chrom-distribution?${params.toString()}`);
}

export function getSampleBurden(cancer: string, limit = 30) {
  const params = new URLSearchParams({ cancer, limit: String(limit) });
  return request<LabelCount[]>(`/api/v1/variants/sample-burden?${params.toString()}`);
}
