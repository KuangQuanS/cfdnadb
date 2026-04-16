import type {
  BiomarkerRecord,
  CancerSummary,
  DownloadAsset,
  FilterOptions,
  LabelCount,
  MafSummary,
  Overview,
  PagedResponse,
  StatisticsOverview,
  StudyDetail,
  TopGene,
  VafDistribution,
  VcfDemo,
  VisualizationSummary
} from "../types/api";

export const cancerSummaryMock: CancerSummary[] = [
  {
    cancer: "Breast",
    sampleCount: 48,
    totalDataFiles: 242,
    avinputCount: 48,
    filteredCount: 48,
    annotatedCount: 48,
    somaticCount: 48,
    plotAssetCount: 2,
    externalAssetCount: 68,
    rawImportStatus: "Completed",
    filteredStatus: "Completed",
    annotatedStatus: "Completed",
    somaticStatus: "Completed",
    plotStatus: "Completed",
    externalStatus: "Completed"
  },
  {
    cancer: "Colorectal",
    sampleCount: 50,
    totalDataFiles: 200,
    avinputCount: 50,
    filteredCount: 50,
    annotatedCount: 50,
    somaticCount: 50,
    plotAssetCount: 2,
    externalAssetCount: 0,
    rawImportStatus: "Completed",
    filteredStatus: "Completed",
    annotatedStatus: "Completed",
    somaticStatus: "Completed",
    plotStatus: "Completed",
    externalStatus: "Not started"
  },
  {
    cancer: "Lung",
    sampleCount: 536,
    totalDataFiles: 1072,
    avinputCount: 536,
    filteredCount: 536,
    annotatedCount: 0,
    somaticCount: 0,
    plotAssetCount: 0,
    externalAssetCount: 0,
    rawImportStatus: "Completed",
    filteredStatus: "Completed",
    annotatedStatus: "Not started",
    somaticStatus: "Not started",
    plotStatus: "Not started",
    externalStatus: "Not started"
  },
  {
    cancer: "Liver",
    sampleCount: 0,
    totalDataFiles: 0,
    avinputCount: 0,
    filteredCount: 0,
    annotatedCount: 0,
    somaticCount: 0,
    plotAssetCount: 0,
    externalAssetCount: 0,
    rawImportStatus: "Not started",
    filteredStatus: "Not started",
    annotatedStatus: "Not started",
    somaticStatus: "Not started",
    plotStatus: "Not started",
    externalStatus: "Not started"
  },
  {
    cancer: "Pancreatic",
    sampleCount: 0,
    totalDataFiles: 0,
    avinputCount: 0,
    filteredCount: 0,
    annotatedCount: 0,
    somaticCount: 0,
    plotAssetCount: 0,
    externalAssetCount: 0,
    rawImportStatus: "Not started",
    filteredStatus: "Not started",
    annotatedStatus: "Not started",
    somaticStatus: "Not started",
    plotStatus: "Not started",
    externalStatus: "Not started"
  }
];

export const overviewMock: Overview = {
  studyCount: 3,
  biomarkerCount: 9,
  datasetCount: 4,
  downloadableAssets: 4,
  leadingDiseases: [
    { label: "Hepatocellular carcinoma", count: 1 },
    { label: "Colorectal cancer", count: 1 },
    { label: "Bladder cancer", count: 1 }
  ],
  leadingTechnologies: [
    { label: "Targeted methylation sequencing", count: 1 },
    { label: "Whole-genome sequencing", count: 1 },
    { label: "Targeted panel sequencing", count: 1 }
  ]
};

export const recordsMock: PagedResponse<BiomarkerRecord> = {
  content: [
    {
      id: 1,
      markerName: "cgHCC_104",
      markerType: "DNA methylation",
      chromosomeLocation: "chr1:145002-145178",
      regulationDirection: "Hyper",
      assayPlatform: "Targeted methylation sequencing",
      specimenType: "Plasma",
      diseaseType: "Hepatocellular carcinoma",
      significanceMetric: "AUC",
      significanceValue: 0.931,
      effectSize: 1.82,
      notes: "Stable performance in independent validation.",
      studyId: 1,
      studyAccession: "CFDNA-001",
      studyTitle: "Genome-wide cfDNA methylation landscape for early hepatocellular carcinoma detection",
      publicationYear: 2024
    },
    {
      id: 2,
      markerName: "LiverScore",
      markerType: "Composite signature",
      chromosomeLocation: null,
      regulationDirection: "Up",
      assayPlatform: "Targeted methylation sequencing",
      specimenType: "Plasma",
      diseaseType: "Hepatocellular carcinoma",
      significanceMetric: "AUC",
      significanceValue: 0.952,
      effectSize: 2.41,
      notes: "Integrated multiregion classifier.",
      studyId: 1,
      studyAccession: "CFDNA-001",
      studyTitle: "Genome-wide cfDNA methylation landscape for early hepatocellular carcinoma detection",
      publicationYear: 2024
    },
    {
      id: 4,
      markerName: "FragShift-27",
      markerType: "Fragmentomics",
      chromosomeLocation: "chr5q31",
      regulationDirection: "Up",
      assayPlatform: "Whole-genome sequencing",
      specimenType: "Plasma",
      diseaseType: "Colorectal cancer",
      significanceMetric: "AUC",
      significanceValue: 0.887,
      effectSize: 1.45,
      notes: "Fragment length skew score.",
      studyId: 2,
      studyAccession: "CFDNA-002",
      studyTitle: "Fragmentomics signatures distinguish colorectal cancer and advanced adenoma",
      publicationYear: 2023
    },
    {
      id: 6,
      markerName: "CRC-Integrated",
      markerType: "Composite signature",
      chromosomeLocation: null,
      regulationDirection: "Up",
      assayPlatform: "Whole-genome sequencing",
      specimenType: "Plasma",
      diseaseType: "Colorectal cancer",
      significanceMetric: "AUC",
      significanceValue: 0.905,
      effectSize: 1.98,
      notes: "Combines fragmentomics and copy number.",
      studyId: 2,
      studyAccession: "CFDNA-002",
      studyTitle: "Fragmentomics signatures distinguish colorectal cancer and advanced adenoma",
      publicationYear: 2023
    },
    {
      id: 7,
      markerName: "TERT C228T",
      markerType: "Mutation",
      chromosomeLocation: "chr5:1295228",
      regulationDirection: "Mutated",
      assayPlatform: "Targeted panel sequencing",
      specimenType: "Urine",
      diseaseType: "Bladder cancer",
      significanceMetric: "Sensitivity",
      significanceValue: 0.76,
      effectSize: 1.29,
      notes: "Most frequent recurrent hotspot.",
      studyId: 3,
      studyAccession: "CFDNA-003",
      studyTitle: "Urine cfDNA mutation panel for bladder cancer surveillance",
      publicationYear: 2022
    }
  ],
  page: 0,
  size: 10,
  totalElements: 5,
  totalPages: 1,
  first: true,
  last: true
};

export const downloadsMock: DownloadAsset[] = [
  {
    id: 1,
    name: "cfDNA master release",
    category: "Full database release",
    description: "Combined curated study, dataset and biomarker release.",
    fileName: "cfdna_master_release.csv",
    contentType: "text/csv",
    fileSizeBytes: 412,
    publicAsset: true,
    studyId: null,
    studyAccession: null,
    downloadUrl: "/api/v1/downloads/1/file"
  },
  {
    id: 2,
    name: "Field dictionary",
    category: "Documentation",
    description: "Data dictionary for the public schema.",
    fileName: "field_dictionary.csv",
    contentType: "text/csv",
    fileSizeBytes: 288,
    publicAsset: true,
    studyId: null,
    studyAccession: null,
    downloadUrl: "/api/v1/downloads/2/file"
  },
  {
    id: 3,
    name: "HCC methylation subset",
    category: "Study subset",
    description: "Study-specific release for the HCC methylation cohort.",
    fileName: "hcc_methylation_subset.csv",
    contentType: "text/csv",
    fileSizeBytes: 218,
    publicAsset: true,
    studyId: 1,
    studyAccession: "CFDNA-001",
    downloadUrl: "/api/v1/downloads/3/file"
  },
  {
    id: 4,
    name: "CRC fragmentomics subset",
    category: "Study subset",
    description: "Study-specific release for the CRC fragmentomics cohort.",
    fileName: "crc_fragmentomics_subset.csv",
    contentType: "text/csv",
    fileSizeBytes: 219,
    publicAsset: true,
    studyId: 2,
    studyAccession: "CFDNA-002",
    downloadUrl: "/api/v1/downloads/4/file"
  }
];

export const studyDetailsMock: Record<number, StudyDetail> = {
  1: {
    id: 1,
    accession: "CFDNA-001",
    title: "Genome-wide cfDNA methylation landscape for early hepatocellular carcinoma detection",
    diseaseType: "Hepatocellular carcinoma",
    sampleSource: "Plasma",
    technology: "Targeted methylation sequencing",
    journal: "Nature Medicine",
    publicationYear: 2024,
    cohortSize: 286,
    doi: "10.1000/cfdna001",
    pmid: "39800001",
    abstractText: "A curated multicenter cfDNA methylation study focused on liver cancer screening cohorts.",
    citation: "Author A et al. Nature Medicine (2024).",
    datasets: [
      {
        id: 1,
        name: "Discovery cohort methylation markers",
        description: "Candidate methylation biomarkers from the discovery cohort.",
        dataType: "Methylation markers",
        recordCount: 124,
        fileFormat: "CSV",
        releaseVersion: "v1.0"
      }
    ],
    sampleGroups: [
      { id: 1, datasetId: 1, groupName: "Discovery HCC cases", conditionName: "Case", sampleType: "Plasma cfDNA", sampleCount: 82 },
      { id: 2, datasetId: 1, groupName: "Discovery controls", conditionName: "Control", sampleType: "Plasma cfDNA", sampleCount: 54 }
    ],
    biomarkers: recordsMock.content.filter((record) => record.studyId === 1),
    downloads: downloadsMock.filter((item) => item.studyId === 1)
  },
  2: {
    id: 2,
    accession: "CFDNA-002",
    title: "Fragmentomics signatures distinguish colorectal cancer and advanced adenoma",
    diseaseType: "Colorectal cancer",
    sampleSource: "Plasma",
    technology: "Whole-genome sequencing",
    journal: "Gut",
    publicationYear: 2023,
    cohortSize: 198,
    doi: "10.1000/cfdna002",
    pmid: "39800002",
    abstractText: "This study benchmarks fragment length, end motif and copy-number signals across colorectal cohorts.",
    citation: "Author B et al. Gut (2023).",
    datasets: [
      {
        id: 3,
        name: "Fragmentomic signature matrix",
        description: "Fragment size and end motif summary matrix.",
        dataType: "Fragmentomics",
        recordCount: 98,
        fileFormat: "CSV",
        releaseVersion: "v1.1"
      }
    ],
    sampleGroups: [
      { id: 5, datasetId: 3, groupName: "CRC cases", conditionName: "Case", sampleType: "Plasma cfDNA", sampleCount: 120 },
      { id: 6, datasetId: 3, groupName: "Advanced adenoma", conditionName: "Case", sampleType: "Plasma cfDNA", sampleCount: 38 }
    ],
    biomarkers: recordsMock.content.filter((record) => record.studyId === 2),
    downloads: downloadsMock.filter((item) => item.studyId === 2)
  },
  3: {
    id: 3,
    accession: "CFDNA-003",
    title: "Urine cfDNA mutation panel for bladder cancer surveillance",
    diseaseType: "Bladder cancer",
    sampleSource: "Urine",
    technology: "Targeted panel sequencing",
    journal: "Clinical Cancer Research",
    publicationYear: 2022,
    cohortSize: 142,
    doi: "10.1000/cfdna003",
    pmid: "39800003",
    abstractText: "A longitudinal urine cfDNA panel study evaluating surveillance performance after surgery.",
    citation: "Author C et al. Clin Cancer Res (2022).",
    datasets: [
      {
        id: 4,
        name: "Urine mutation panel calls",
        description: "Driver mutation calls across surveillance visits.",
        dataType: "Mutation panel",
        recordCount: 73,
        fileFormat: "CSV",
        releaseVersion: "v1.0"
      }
    ],
    sampleGroups: [
      { id: 7, datasetId: 4, groupName: "Surveillance positives", conditionName: "Case", sampleType: "Urine cfDNA", sampleCount: 61 },
      { id: 8, datasetId: 4, groupName: "Surveillance negatives", conditionName: "Control", sampleType: "Urine cfDNA", sampleCount: 81 }
    ],
    biomarkers: recordsMock.content.filter((record) => record.studyId === 3),
    downloads: []
  }
};

export const filtersMock: FilterOptions = {
  diseaseTypes: ["Bladder cancer", "Colorectal cancer", "Hepatocellular carcinoma"],
  sampleSources: ["Plasma", "Urine"],
  technologies: ["Targeted methylation sequencing", "Targeted panel sequencing", "Whole-genome sequencing"],
  markerTypes: ["Composite signature", "DNA methylation", "Fragmentomics", "Mutation"],
  specimenTypes: ["Plasma", "Urine"],
  publicationYears: [2024, 2023, 2022]
};

export const visualizationMock: VisualizationSummary = {
  diseaseDistribution: overviewMock.leadingDiseases,
  technologyDistribution: overviewMock.leadingTechnologies,
  markerTypeDistribution: [
    { label: "Composite signature", count: 3 },
    { label: "DNA methylation", count: 2 },
    { label: "Mutation", count: 2 },
    { label: "Fragmentomics", count: 1 }
  ],
  sampleSourceDistribution: [
    { label: "Plasma", count: 2 },
    { label: "Urine", count: 1 }
  ],
  publicationTrend: [
    { year: 2022, count: 1 },
    { year: 2023, count: 1 },
    { year: 2024, count: 1 }
  ]
};

export const vcfDemoMock: VcfDemo = {
  totalDatasetFolders: 3,
  totalVcfFiles: 12,
  totalSamples: 146,
  parsedVariantCount: 427,
  datasetFolders: [
    {
      datasetKey: "CRC_2023",
      displayName: "Colorectal plasma surveillance set",
      publicReleaseId: "CFDNA-VCF-CRC-2023",
      diseaseType: "Colorectal cancer",
      sampleSource: "Plasma",
      platform: "Targeted panel sequencing",
      referenceBuild: "hg38",
      sampleCount: 58,
      vcfFileCount: 6,
      parsedVariantCount: 192,
      publication: "Gut (demo placeholder)",
      parserStatus: "Indexed and ready for metadata registration",
      nextAction: "Attach sample manifest and annotation summary"
    },
    {
      datasetKey: "HCC_2024",
      displayName: "HCC methylation-informed mutation subset",
      publicReleaseId: "CFDNA-VCF-HCC-2024",
      diseaseType: "Hepatocellular carcinoma",
      sampleSource: "Plasma",
      platform: "Hybrid capture panel",
      referenceBuild: "hg38",
      sampleCount: 44,
      vcfFileCount: 4,
      parsedVariantCount: 131,
      publication: "Nature Medicine (demo placeholder)",
      parserStatus: "VCF files detected; public metadata incomplete",
      nextAction: "Complete release metadata and cohort summary"
    },
    {
      datasetKey: "BLCA_2022",
      displayName: "Urine cfDNA recurrence monitoring set",
      publicReleaseId: "CFDNA-VCF-BLCA-2022",
      diseaseType: "Bladder cancer",
      sampleSource: "Urine",
      platform: "Amplicon panel",
      referenceBuild: "hg19",
      sampleCount: 44,
      vcfFileCount: 2,
      parsedVariantCount: 104,
      publication: "Clin Cancer Res (demo placeholder)",
      parserStatus: "Release registered; public variant view pending",
      nextAction: "Run import worker and publish curated variant summary"
    }
  ],
  pipelineSteps: [
    {
      step: "01",
      title: "Register dataset release",
      description: "Create a public dataset record, accession and release note before parsing any variant file.",
      output: "dataset, release metadata"
    },
    {
      step: "02",
      title: "Parse per-sample VCF",
      description: "Extract CHROM, POS, REF, ALT, QUAL, FILTER, INFO and sample FORMAT fields into a normalized import table.",
      output: "raw_variant_import"
    },
    {
      step: "03",
      title: "Annotate biological meaning",
      description: "Resolve gene symbol, consequence, protein change, ClinVar and COSMIC tags from annotation fields or a downstream annotator.",
      output: "variant_record"
    },
    {
      step: "04",
      title: "Expose public browser",
      description: "Publish dataset summaries, release notes, download links and searchable variant rows without exposing private storage details.",
      output: "dataset detail, variant browser"
    }
  ],
  exampleVariants: [
    {
      datasetKey: "CRC_2023",
      sampleId: "CRC-017",
      gene: "KRAS",
      chromosome: "chr12",
      position: 25245350,
      ref: "C",
      alt: "T",
      variantType: "SNV",
      consequence: "missense_variant",
      proteinChange: "p.G12D",
      vaf: 0.084,
      depth: 1842,
      filterStatus: "PASS"
    },
    {
      datasetKey: "CRC_2023",
      sampleId: "CRC-024",
      gene: "APC",
      chromosome: "chr5",
      position: 112175770,
      ref: "G",
      alt: "A",
      variantType: "SNV",
      consequence: "stop_gained",
      proteinChange: "p.R1450*",
      vaf: 0.051,
      depth: 1336,
      filterStatus: "PASS"
    },
    {
      datasetKey: "HCC_2024",
      sampleId: "HCC-011",
      gene: "TERT",
      chromosome: "chr5",
      position: 1295228,
      ref: "G",
      alt: "A",
      variantType: "SNV",
      consequence: "regulatory_region_variant",
      proteinChange: null,
      vaf: 0.023,
      depth: 2104,
      filterStatus: "PASS"
    },
    {
      datasetKey: "BLCA_2022",
      sampleId: "BLCA-032",
      gene: "FGFR3",
      chromosome: "chr4",
      position: 1807894,
      ref: "C",
      alt: "A",
      variantType: "SNV",
      consequence: "missense_variant",
      proteinChange: "p.S249C",
      vaf: 0.117,
      depth: 965,
      filterStatus: "PASS"
    },
    {
      datasetKey: "BLCA_2022",
      sampleId: "BLCA-032",
      gene: "TERT",
      chromosome: "chr5",
      position: 1295250,
      ref: "C",
      alt: "T",
      variantType: "SNV",
      consequence: "regulatory_region_variant",
      proteinChange: null,
      vaf: 0.094,
      depth: 1008,
      filterStatus: "PanelOfNormalsFlag"
    }
  ],
  diseaseDistribution: [
    { label: "Colorectal cancer", count: 1 },
    { label: "Hepatocellular carcinoma", count: 1 },
    { label: "Bladder cancer", count: 1 }
  ],
  sampleSourceDistribution: [
    { label: "Plasma", count: 2 },
    { label: "Urine", count: 1 }
  ]
};

export const funcDistributionMock: LabelCount[] = [
  { label: "intronic", count: 79842 },
  { label: "intergenic", count: 28651 },
  { label: "exonic", count: 15203 },
  { label: "UTR3", count: 4812 },
  { label: "UTR5", count: 1243 },
  { label: "splicing", count: 987 },
  { label: "ncRNA_intronic", count: 2134 },
  { label: "ncRNA_exonic", count: 521 },
  { label: "upstream", count: 311 },
  { label: "downstream", count: 299 }
];

export const exonicDistributionMock: LabelCount[] = [
  { label: "nonsynonymous SNV", count: 11842 },
  { label: "synonymous SNV", count: 2103 },
  { label: "stopgain", count: 612 },
  { label: "frameshift deletion", count: 287 },
  { label: "frameshift insertion", count: 194 },
  { label: "nonframeshift deletion", count: 98 },
  { label: "nonframeshift insertion", count: 41 },
  { label: "stoploss", count: 26 }
];

export const chromDistributionMock: LabelCount[] = [
  { label: "chr1", count: 9821 },
  { label: "chr2", count: 7643 },
  { label: "chr3", count: 6102 },
  { label: "chr4", count: 5421 },
  { label: "chr5", count: 5893 },
  { label: "chr6", count: 5234 },
  { label: "chr7", count: 6012 },
  { label: "chr8", count: 4876 },
  { label: "chr9", count: 3921 },
  { label: "chr10", count: 4213 },
  { label: "chr11", count: 5102 },
  { label: "chr12", count: 4987 },
  { label: "chr13", count: 2834 },
  { label: "chr14", count: 3012 },
  { label: "chr15", count: 2976 },
  { label: "chr16", count: 3421 },
  { label: "chr17", count: 4123 },
  { label: "chr18", count: 2012 },
  { label: "chr19", count: 3876 },
  { label: "chr20", count: 2534 },
  { label: "chr21", count: 1243 },
  { label: "chr22", count: 1876 },
  { label: "chrX", count: 2987 },
  { label: "chrY", count: 312 }
];

export const sampleBurdenMock: LabelCount[] = [
  { label: "RTCG0P0009-1-TWN1", count: 4821 },
  { label: "RTCG0P0018-1-TWN1", count: 3942 },
  { label: "RTCG0P0044-1-THN1", count: 3512 },
  { label: "RTCG0P0039-1-THN1", count: 3201 },
  { label: "RTCG0P0012-1-TWN1", count: 2987 },
  { label: "RTCG0P0031-1-TWN1", count: 2745 },
  { label: "RTCG0P0027-1-THN1", count: 2634 },
  { label: "RTCG0P0055-1-TWN1", count: 2512 },
  { label: "RTCG0P0003-1-TWN1", count: 2389 },
  { label: "RTCG0P0022-1-THN1", count: 2201 },
  { label: "RTCG0P0047-1-TWN1", count: 2087 },
  { label: "RTCG0P0008-1-THN1", count: 1976 },
  { label: "RTCG0P0016-1-TWN1", count: 1843 },
  { label: "RTCG0P0033-1-THN1", count: 1712 },
  { label: "RTCG0P0041-1-TWN1", count: 1634 },
  { label: "RTCG0P0019-1-TWN1", count: 1521 },
  { label: "RTCG0P0028-1-THN1", count: 1398 },
  { label: "RTCG0P0006-1-TWN1", count: 1287 },
  { label: "RTCG0P0037-1-THN1", count: 1143 },
  { label: "RTCG0P0014-1-TWN1", count: 987 }
];

const mafSummaryMock: MafSummary = {
  source: "cfDNA",
  totalVariants: 86197,
  totalSamples: 1425,
  totalGenes: 16129
};

const statisticsTopGenesMock: TopGene[] = [
  { gene: "TTN", count: 246 },
  { gene: "MUC12", count: 160 },
  { gene: "MUC16", count: 101 },
  { gene: "HRNR", count: 88 },
  { gene: "OBSCN", count: 88 },
  { gene: "HMCN2", count: 83 },
  { gene: "PLEC", count: 78 },
  { gene: "FLG", count: 77 },
  { gene: "TNRC6A", count: 68 },
  { gene: "TNXB", count: 66 }
];

export const statisticsOverviewMock: StatisticsOverview = {
  source: "cfDNA",
  generatedAt: "2026-04-14T00:00:00Z",
  cancerSummary: cancerSummaryMock,
  mafSummary: mafSummaryMock,
  funcDistribution: funcDistributionMock,
  exonicDistribution: exonicDistributionMock,
  chromDistribution: chromDistributionMock,
  topGenes: statisticsTopGenesMock
};

export const vafDistributionMock: VafDistribution[] = [
  { cancerType: "Breast", values: [0.43, 0.42, 0.44, 0.51, 0.45, 0.47, 0.41, 0.46, 0.43, 0.48], sampleCount: 10 },
  { cancerType: "Lung", values: [0.44, 0.45, 0.43, 0.47, 0.50, 0.42, 0.46, 0.49, 0.44, 0.48], sampleCount: 10 },
  { cancerType: "Liver", values: [0.46, 0.48, 0.47, 0.49, 0.50, 0.45, 0.51, 0.47, 0.48, 0.46], sampleCount: 10 },
  { cancerType: "Gastric", values: [0.45, 0.50, 0.48, 0.55, 0.47, 0.52, 0.49, 0.53, 0.46, 0.51], sampleCount: 10 },
  { cancerType: "Pdac", values: [0.44, 0.46, 0.48, 0.45, 0.47, 0.49, 0.43, 0.50, 0.46, 0.44], sampleCount: 10 },
];
