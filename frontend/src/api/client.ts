import type {
  ApiResponse,
  CohortFile,
  DatabaseStats,
  DataFile,
  DownloadAsset,
  FilterOptions,
  LabelCount,
  MafFilterOptions,
  MafGeneSummary,
  MafSummary,
  MafMutation,
  OncoplottData,
  Overview,
  PagedResponse,
  BiomarkerRecord,
  SampleBrowseItem,
  SampleDetail,
  SampleSelection,
  StudyDetail,
  StatisticsOverview,
  VafDistribution,
  VisualizationSummary,
  VcfDemo,
  CancerAsset,
  CancerSummary,
  GeneVariant,
  GeneSummary,
  GeneNcbiSummary,
  TopGene,
  StatisticsSource,
  GenePlot
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
  statisticsOverviewMock,
  sampleBurdenMock,
  vafDistributionMock
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
  if (path.startsWith("/api/v1/statistics/overview")) return statisticsOverviewMock;
  if (path.startsWith("/api/v1/variants/func-distribution")) return funcDistributionMock;
  if (path.startsWith("/api/v1/variants/exonic-distribution")) return exonicDistributionMock;
  if (path.startsWith("/api/v1/variants/chrom-distribution")) return chromDistributionMock;
  if (path.startsWith("/api/v1/variants/sample-burden")) return sampleBurdenMock;
  if (path.startsWith("/api/v1/statistics/vaf-distribution")) return vafDistributionMock;
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
  const url = `${API_BASE}${path}`;
  console.log("[requestLive] =>", url);
  const response = await fetch(url);
  console.log("[requestLive] <=", response.status, url);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  const payload = (await response.json()) as ApiResponse<T>;
  console.log("[requestLive] data:", payload.data);
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

export function getStatisticsOverview() {
  return request<StatisticsOverview>("/api/v1/statistics/overview");
}

export function getVafDistribution() {
  return request<VafDistribution[]>("/api/v1/statistics/vaf-distribution");
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

export interface MafQueryFilters {
  source?: string;
  gene?: string;
  sample?: string;
  cancerType?: string[];
  chromosome?: string[];
  variantClass?: string[];
  variantType?: string[];
  page?: number;
  size?: number;
}

export function queryMafMutations(filters: MafQueryFilters) {
  const params = new URLSearchParams();
  params.set("source", filters.source ?? "cfDNA");
  params.set("page", String(filters.page ?? 1));
  params.set("size", String(filters.size ?? 20));
  if (filters.gene) params.set("gene", filters.gene);
  if (filters.sample) params.set("sample", filters.sample);
  for (const value of filters.cancerType ?? []) params.append("cancerType", value);
  for (const value of filters.chromosome ?? []) params.append("chromosome", value);
  for (const value of filters.variantClass ?? []) params.append("variantClass", value);
  for (const value of filters.variantType ?? []) params.append("variantType", value);
  return requestLive<PagedResponse<MafMutation>>(`/api/v1/maf-mutations?${params.toString()}`);
}

export function queryMafGenes(filters: MafQueryFilters) {
  const params = new URLSearchParams();
  params.set("source", filters.source ?? "cfDNA");
  params.set("page", String(filters.page ?? 1));
  params.set("size", String(filters.size ?? 20));
  if (filters.gene) params.set("gene", filters.gene);
  if (filters.sample) params.set("sample", filters.sample);
  for (const value of filters.cancerType ?? []) params.append("cancerType", value);
  for (const value of filters.chromosome ?? []) params.append("chromosome", value);
  for (const value of filters.variantClass ?? []) params.append("variantClass", value);
  for (const value of filters.variantType ?? []) params.append("variantType", value);
  return requestLive<PagedResponse<MafGeneSummary>>(`/api/v1/maf-mutations/genes?${params.toString()}`);
}

export function getMafFilterOptions(source: string) {
  return requestLive<MafFilterOptions>(`/api/v1/maf-mutations/filter-options?source=${encodeURIComponent(source)}`);
}

export function getMafSummary(filters: MafQueryFilters) {
  const params = new URLSearchParams();
  params.set("source", filters.source ?? "cfDNA");
  if (filters.gene) params.set("gene", filters.gene);
  if (filters.sample) params.set("sample", filters.sample);
  for (const value of filters.cancerType ?? []) params.append("cancerType", value);
  for (const value of filters.chromosome ?? []) params.append("chromosome", value);
  for (const value of filters.variantClass ?? []) params.append("variantClass", value);
  for (const value of filters.variantType ?? []) params.append("variantType", value);
  return requestLive<MafSummary>(`/api/v1/maf-mutations/summary?${params.toString()}`);
}

export function getMafGeneSuggestions(source: string, q: string, limit = 10) {
  const params = new URLSearchParams({ source, q, limit: String(limit) });
  return requestLive<string[]>(`/api/v1/maf-mutations/gene-suggestions?${params.toString()}`);
}

export function getMafSampleSuggestions(source: string, q: string, limit = 10) {
  const params = new URLSearchParams({ source, q, limit: String(limit) });
  return requestLive<string[]>(`/api/v1/maf-mutations/sample-suggestions?${params.toString()}`);
}

export function getMafGeneDetail(gene: string, filters: Omit<MafQueryFilters, "gene" | "page" | "size">) {
  const params = new URLSearchParams();
  params.set("source", filters.source ?? "cfDNA");
  if (filters.sample) params.set("sample", filters.sample);
  for (const value of filters.cancerType ?? []) params.append("cancerType", value);
  for (const value of filters.chromosome ?? []) params.append("chromosome", value);
  for (const value of filters.variantClass ?? []) params.append("variantClass", value);
  for (const value of filters.variantType ?? []) params.append("variantType", value);
  return requestLive<MafGeneSummary>(`/api/v1/maf-mutations/genes/${encodeURIComponent(gene)}?${params.toString()}`);
}

export function getGeneNcbiSummary(symbol: string) {
  return requestLive<GeneNcbiSummary | null>(`/api/v1/genes/${encodeURIComponent(symbol)}/ncbi-summary`);
}

export function queryMafGeneMutations(gene: string, filters: Omit<MafQueryFilters, "gene">) {
  const params = new URLSearchParams();
  params.set("source", filters.source ?? "cfDNA");
  params.set("page", String(filters.page ?? 1));
  params.set("size", String(filters.size ?? 20));
  if (filters.sample) params.set("sample", filters.sample);
  for (const value of filters.cancerType ?? []) params.append("cancerType", value);
  for (const value of filters.chromosome ?? []) params.append("chromosome", value);
  for (const value of filters.variantClass ?? []) params.append("variantClass", value);
  for (const value of filters.variantType ?? []) params.append("variantType", value);
  return requestLive<PagedResponse<MafMutation>>(`/api/v1/maf-mutations/genes/${encodeURIComponent(gene)}/mutations?${params.toString()}`);
}

// ---- Statistics page ----

export function getStatisticsSources(cancer: string) {
  return requestLive<StatisticsSource[]>(`/api/v1/statistics/${encodeURIComponent(cancer)}/sources`);
}

export function getStatisticsPlots(cancer: string, source: string) {
  const params = new URLSearchParams({ source });
  return requestLive<CancerAsset[]>(`/api/v1/statistics/${encodeURIComponent(cancer)}/plots?${params.toString()}`);
}

export function getStatisticsGenes(cancer: string, source: string, query: string) {
  const params = new URLSearchParams({ source, query });
  return requestLive<string[]>(`/api/v1/statistics/${encodeURIComponent(cancer)}/genes?${params.toString()}`);
}

export function getStatisticsGenePlotUrl(cancer: string, source: string, gene: string) {
  const params = new URLSearchParams({ source, gene });
  return `${API_BASE}/api/v1/statistics/${encodeURIComponent(cancer)}/gene-plot?${params.toString()}`;
}

// ---- Gene lollipop plots ----

export function getGenePlots(gene: string, cancers?: string[]) {
  const params = new URLSearchParams({ gene });
  for (const c of cancers ?? []) params.append("cancer", c);
  return requestLive<GenePlot[]>(`/api/v1/gene-plots?${params.toString()}`);
}

export function toGenePlotUrl(url: string) {
  return `${API_BASE}${url}`;
}

export function getOncoplottData(source: string, cancerTypes: string[], limit = 20) {
  const params = new URLSearchParams({ source, limit: String(limit) });
  for (const c of cancerTypes) params.append("cancerType", c);
  return requestLive<OncoplottData>(`/api/v1/maf-mutations/oncoplot?${params.toString()}`);
}

// ---- Cohort files (Browse Files tab) ----

export function getCohortFiles(cancer: string, source?: string, category?: string) {
  const params = new URLSearchParams({ cancer });
  if (source) params.set("source", source);
  if (category) params.set("category", category);
  return requestLive<CohortFile[]>(`/api/v1/cohort/files?${params.toString()}`);
}

export function getSourceDistribution(cancer: string) {
  const params = new URLSearchParams({ cancer });
  return requestLive<LabelCount[]>(`/api/v1/cohort/source-distribution?${params.toString()}`);
}

export interface SampleBrowseFilters {
  cancers?: string[];
  sources?: string[];
  gene?: string;
  sample?: string;
  minVariants?: number;
  hasAnnotated?: boolean;
  hasSomatic?: boolean;
  includeTopGenes?: boolean;
  page?: number;
  size?: number;
}

export function getSampleBrowse(filters: SampleBrowseFilters) {
  const params = new URLSearchParams();
  for (const cancer of filters.cancers ?? []) params.append("cancer", cancer);
  for (const source of filters.sources ?? []) params.append("source", source);
  if (filters.gene) params.set("gene", filters.gene);
  if (filters.sample) params.set("sample", filters.sample);
  if (filters.minVariants != null) params.set("minVariants", String(filters.minVariants));
  if (filters.hasAnnotated) params.set("hasAnnotated", "true");
  if (filters.hasSomatic) params.set("hasSomatic", "true");
  if (filters.includeTopGenes === false) params.set("includeTopGenes", "false");
  params.set("page", String(filters.page ?? 1));
  params.set("size", String(filters.size ?? 25));
  return requestLive<PagedResponse<SampleBrowseItem>>(`/api/v1/samples?${params.toString()}`);
}

export function getSampleDetail(cancer: string, source: string, sampleId: string) {
  const params = new URLSearchParams({ cancer, source, sampleId });
  return requestLive<SampleDetail>(`/api/v1/samples/detail?${params.toString()}`);
}

export async function downloadSampleFiles(fileType: string, samples: SampleSelection[]) {
  const response = await fetch(`${API_BASE}/api/v1/samples/download`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fileType, samples })
  });
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  const disposition = response.headers.get("content-disposition") ?? "";
  const fileNameMatch = disposition.match(/filename=\"([^\"]+)\"/i);
  const fileName = fileNameMatch?.[1] ?? `cfdnadb_${fileType}_samples.zip`;
  return {
    blob: await response.blob(),
    fileName
  };
}
