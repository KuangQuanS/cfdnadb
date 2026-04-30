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

export interface VcfDatasetFolder {
  datasetKey: string;
  displayName: string;
  publicReleaseId: string;
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

export interface VafBodyMapEntry {
  cohort: string;
  cancerType: string;
  organKey: string;
  meanVaf: number;
  medianVaf: number;
  minVaf: number;
  maxVaf: number;
  recordCount: number;
  sampleCount: number;
}

export interface VafBodyMap {
  gene: string;
  entries: VafBodyMapEntry[];
  maxMeanVaf: number;
}

export interface CancerSummary {
  cancer: string;
  sampleCount: number;
  totalDataFiles: number;
  avinputCount: number;
  filteredCount: number;
  annotatedCount: number;
  somaticCount: number;
  plotAssetCount: number;
  externalAssetCount: number;
  mutationCount: number;
  rawImportStatus: string;
  filteredStatus: string;
  annotatedStatus: string;
  somaticStatus: string;
  plotStatus: string;
  externalStatus: string;
}

export interface TopGene {
  gene: string;
  count: number;
}

export interface GeneNcbiSummary {
  symbol: string;
  geneId: string;
  name: string | null;
  summary: string | null;
  aliases: string[];
  ncbiUrl: string;
}

export interface GeneVariant {
  chr: string;
  start: string;
  end: string;
  ref: string;
  alt: string;
  func: string;
  exonicFunc: string;
  gene: string;
  aaChange: string;
  sample: string;
}

export interface DatabaseStats {
  totalVariants: number;
  totalSamples: number;
  totalGenes: number;
  cohortCount: number;
}

export interface DataFile {
  cancer: string;
  fileType: string;
  name: string;
  fileName: string;
  sizeBytes: number;
  downloadUrl: string;
}

export interface GeneSummary {
  gene: string;
  cancer: string;
  totalVariants: number;
  uniqueSamples: number;
  funcBreakdown: LabelCount[];
  exonicBreakdown: LabelCount[];
  chromBreakdown: LabelCount[];
}

export interface CancerAsset {
  category: string;
  title: string;
  fileName: string;
  sizeBytes: number;
  assetUrl: string;
}

export interface MafMutation {
  id: number;
  hugoSymbol: string;
  cancerType: string;
  chromosome: string;
  startPosition: string;
  endPosition: string;
  referenceAllele: string;
  tumorSeqAllele2: string;
  variantClassification: string;
  variantType: string;
  tumorSampleBarcode: string;
  transcript: string;
  exon: string;
  aaChange: string;
  functionalRegion: string;
  exonicFunction: string;
}

export interface MafFilterOptions {
  source: string;
  cancerTypes: string[];
  chromosomes: string[];
  variantClassifications: string[];
  variantTypes: string[];
}

export interface MafSummary {
  source: string;
  totalVariants: number;
  totalSamples: number;
  totalGenes: number;
}

export interface StatisticsOverview {
  source: string;
  generatedAt: string;
  cancerSummary: CancerSummary[];
  mafSummary: MafSummary;
  funcDistribution: LabelCount[];
  exonicDistribution: LabelCount[];
  chromDistribution: LabelCount[];
  topGenes: TopGene[];
}

export interface MafGeneSummary {
  hugoSymbol: string;
  totalVariants: number;
  totalSamples: number;
  totalCoordinates: number;
  cancerTypesPreview: string;
  sampleBarcodesPreview: string;
  coordinatePreview: string;
  allelesPreview: string;
  variantClassesPreview: string;
  variantTypesPreview: string;
  annotationPreview: string;
}

export interface GenePlot {
  fileName: string;
  url: string;
  cancer: string;
  gene: string;
  chromosome: string;
  startPosition: string;
  endPosition: string;
  coordinateLabel: string;
}

export interface StatisticsSource {
  source: string;
  hasGenePlots: boolean;
}

export interface VafDistribution {
  cancerType: string;
  values: number[];
  sampleCount: number;
}

export interface OncoplottCell {
  gene: string;
  sample: string;
  variantClass: string;
}

export interface OncoplottData {
  genes: string[];
  samples: string[];
  cells: OncoplottCell[];
  geneCounts: Record<string, number>;
  sampleCounts: Record<string, number>;
}

export interface CohortFile {
  cancer: string;
  source: string;
  category: string;
  fileName: string;
  displayName: string;
  sampleId: string | null;
  sizeBytes: number;
  downloadUrl: string;
}

export interface SampleBrowseItem {
  sampleId: string;
  cancer: string;
  source: string;
  variantCount: number;
  topGenes: string[];
  availableFiles: string[];
  hasAnnotated: boolean;
  hasSomatic: boolean;
}

export interface SampleFile {
  type: string;
  fileName: string;
  sizeBytes: number;
  lastModified: string;
  downloadUrl: string;
}

export interface SampleDetail {
  sampleId: string;
  cancer: string;
  source: string;
  variantCount: number;
  topGenes: LabelCount[];
  files: SampleFile[];
}

export interface SampleSelection {
  sampleId: string;
  cancer: string;
  source: string;
}
