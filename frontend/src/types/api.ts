export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string | null;
  timestamp: string;
}

export interface LabelCount {
  label: string;
  count: number;
}

export interface YearCount {
  year: number;
  count: number;
}

export interface Overview {
  studyCount: number;
  biomarkerCount: number;
  datasetCount: number;
  downloadableAssets: number;
  leadingDiseases: LabelCount[];
  leadingTechnologies: LabelCount[];
}

export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface BiomarkerRecord {
  id: number;
  markerName: string;
  markerType: string;
  chromosomeLocation: string | null;
  regulationDirection: string | null;
  assayPlatform: string | null;
  specimenType: string | null;
  diseaseType: string;
  significanceMetric: string | null;
  significanceValue: number | null;
  effectSize: number | null;
  notes: string | null;
  studyId: number;
  studyAccession: string;
  studyTitle: string;
  publicationYear: number | null;
}

export interface Dataset {
  id: number;
  name: string;
  description: string | null;
  dataType: string | null;
  recordCount: number | null;
  fileFormat: string | null;
  releaseVersion: string | null;
}

export interface SampleGroup {
  id: number;
  datasetId: number;
  groupName: string;
  conditionName: string | null;
  sampleType: string | null;
  sampleCount: number | null;
}

export interface DownloadAsset {
  id: number;
  name: string;
  category: string;
  description: string | null;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  publicAsset: boolean;
  studyId: number | null;
  studyAccession: string | null;
  downloadUrl: string;
}

export interface StudySummary {
  id: number;
  accession: string;
  title: string;
  diseaseType: string;
  sampleSource: string;
  technology: string;
  journal: string | null;
  publicationYear: number | null;
  cohortSize: number | null;
  biomarkerCount: number;
  datasetCount: number;
}

export interface StudyDetail extends Omit<StudySummary, "biomarkerCount" | "datasetCount"> {
  doi: string | null;
  pmid: string | null;
  abstractText: string | null;
  citation: string | null;
  datasets: Dataset[];
  sampleGroups: SampleGroup[];
  biomarkers: BiomarkerRecord[];
  downloads: DownloadAsset[];
}

export interface FilterOptions {
  diseaseTypes: string[];
  sampleSources: string[];
  technologies: string[];
  markerTypes: string[];
  specimenTypes: string[];
  publicationYears: number[];
}

export interface VisualizationSummary {
  diseaseDistribution: LabelCount[];
  technologyDistribution: LabelCount[];
  markerTypeDistribution: LabelCount[];
  sampleSourceDistribution: LabelCount[];
  publicationTrend: YearCount[];
}

export interface VcfDatasetFolder {`r`n  datasetKey: string;`r`n  displayName: string;`r`n  publicReleaseId: string;
  diseaseType: string;
  sampleSource: string;
  platform: string;
  referenceBuild: string;
  sampleCount: number;
  vcfFileCount: number;
  parsedVariantCount: number;
  publication: string;
  parserStatus: string;
  nextAction: string;
}

export interface VcfPipelineStep {
  step: string;
  title: string;
  description: string;
  output: string;
}

export interface VcfVariantRecord {
  datasetKey: string;
  sampleId: string;
  gene: string;
  chromosome: string;
  position: number;
  ref: string;
  alt: string;
  variantType: string;
  consequence: string;
  proteinChange: string | null;
  vaf: number | null;
  depth: number | null;
  filterStatus: string;
}

export interface VcfDemo {
  totalDatasetFolders: number;
  totalVcfFiles: number;
  totalSamples: number;
  parsedVariantCount: number;
  datasetFolders: VcfDatasetFolder[];
  pipelineSteps: VcfPipelineStep[];
  exampleVariants: VcfVariantRecord[];
  diseaseDistribution: LabelCount[];
  sampleSourceDistribution: LabelCount[];
}
