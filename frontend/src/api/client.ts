import type {
  ApiResponse,
  DownloadAsset,
  FilterOptions,
  Overview,
  PagedResponse,
  BiomarkerRecord,
  StudyDetail,
  VisualizationSummary,
  VcfDemo
} from "../types/api";
import {
  downloadsMock,
  filtersMock,
  overviewMock,
  recordsMock,
  studyDetailsMock,
  vcfDemoMock,
  visualizationMock
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
