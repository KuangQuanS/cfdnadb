export interface MarkerRecord {
  markerDbId: string;
  variantName: string;
  markerType: string;
  geneSymbol: string;
  geneName: string;
  chromosome: string;
  position: number;
  associatedConditions: string[];
  cancer: string;
  specimen: string;
  markerClass: string;
  omics: string;
  featureType: string;
  collection: string;
  element: string;
  geneBiotype: string;
  genomeLocation: string;
  ensemblId: string;
  ncbiId: string;
  description: string;
}

export interface MarkerSeriesGroup {
  label: string;
  values: number[];
  color: string;
}

export interface MarkerTrackLane {
  id: string;
  label: string;
  bars: number[];
}

export interface MarkerDetail {
  record: MarkerRecord;
  version: string;
  createdAt: string;
  updatedAt: string;
  organism: string;
  conditionsHierarchy: string[];
  sources: string[];
  links: { label: string; url: string }[];
  omicsOptions: string[];
  featureTypeOptions: string[];
  collectionOptions: string[];
  specimenOptions: string[];
  elementOptions: string[];
  selectedOmics: string;
  selectedFeatureType: string;
  selectedCollection: string;
  selectedSpecimen: string;
  selectedElement: string;
  profileGroups: MarkerSeriesGroup[];
  comparisonGroups: MarkerSeriesGroup[];
  trackFeatures: string[];
  trackLanes: MarkerTrackLane[];
  selectedFeature: string;
  selectedChromosome: string;
  relatedMarkers: string[];
}

const COLORS = ["#7487ff", "#ff7c66", "#42cfa1", "#b58cff", "#f3a15d"];
const CHROMOSOMES = [
  "chr1", "chr2", "chr3", "chr4", "chr5", "chr6", "chr7", "chr8",
  "chr9", "chr10", "chr11", "chr12", "chr13", "chr14", "chr15", "chr16",
  "chr17", "chr18", "chr19", "chr20", "chr21", "chr22", "chrX", "chrY"
];

const MARKER_RECORDS: MarkerRecord[] = [
  {
    markerDbId: "MDB00595091",
    variantName: "rs1385526",
    markerType: "SNP Panel",
    geneSymbol: "LRP1B",
    geneName: "Low-density lipoprotein receptor-related protein 1B",
    chromosome: "chr2",
    position: 141089366,
    associatedConditions: ["NSCLC", "Smoking-associated lung cancer"],
    cancer: "Lung",
    specimen: "Plasma",
    markerClass: "Single Nucleotide Mutation",
    omics: "cfDNA",
    featureType: "Mutation hotspot",
    collection: "CFD-LU-017",
    element: "Genes",
    geneBiotype: "protein_coding",
    genomeLocation: "chr2, 141086316-142889469, +",
    ensemblId: "ENSG00000168702",
    ncbiId: "53353",
    description: "LRP1B is frequently altered in smoking-associated lung cancer and is often detected together with TP53/KRAS signatures in plasma cfDNA."
  },
  {
    markerDbId: "MDB00595092",
    variantName: "TP53 p.R175H",
    markerType: "Hotspot SNV",
    geneSymbol: "TP53",
    geneName: "Tumor protein p53",
    chromosome: "chr17",
    position: 7673803,
    associatedConditions: ["Breast cancer", "Triple-negative breast cancer"],
    cancer: "Breast",
    specimen: "Plasma",
    markerClass: "Single Nucleotide Mutation",
    omics: "cfDNA",
    featureType: "Mutation hotspot",
    collection: "CFD-BR-102",
    element: "Genes",
    geneBiotype: "protein_coding",
    genomeLocation: "chr17, 7668402-7687550, -",
    ensemblId: "ENSG00000141510",
    ncbiId: "7157",
    description: "TP53 hotspot variants remain a common plasma-detectable marker for aggressive breast cancer subtypes and residual disease monitoring."
  },
  {
    markerDbId: "MDB00595093",
    variantName: "KRAS p.G12D",
    markerType: "SNP Panel",
    geneSymbol: "KRAS",
    geneName: "KRAS proto-oncogene, GTPase",
    chromosome: "chr12",
    position: 25245350,
    associatedConditions: ["Colorectal cancer", "Advanced adenoma"],
    cancer: "Colonrector",
    specimen: "Plasma",
    markerClass: "Single Nucleotide Mutation",
    omics: "cfDNA",
    featureType: "Mutation hotspot",
    collection: "CFD-CO-067",
    element: "Genes",
    geneBiotype: "protein_coding",
    genomeLocation: "chr12, 25205246-25250929, -",
    ensemblId: "ENSG00000133703",
    ncbiId: "3845",
    description: "KRAS hotspot variants are recurrent in colorectal plasma assays and provide high-value triage candidates for targeted follow-up."
  },
  {
    markerDbId: "MDB00595094",
    variantName: "EGFR p.L858R",
    markerType: "Hotspot SNV",
    geneSymbol: "EGFR",
    geneName: "Epidermal growth factor receptor",
    chromosome: "chr7",
    position: 55259515,
    associatedConditions: ["EGFR-mutant NSCLC", "Targeted therapy monitoring"],
    cancer: "Lung",
    specimen: "Plasma",
    markerClass: "Single Nucleotide Mutation",
    omics: "cfDNA",
    featureType: "Mutation hotspot",
    collection: "CFD-LU-041",
    element: "Genes",
    geneBiotype: "protein_coding",
    genomeLocation: "chr7, 55019017-55211628, +",
    ensemblId: "ENSG00000146648",
    ncbiId: "1956",
    description: "EGFR L858R is commonly used for actionable plasma genotyping and early response assessment during targeted therapy."
  },
  {
    markerDbId: "MDB00595095",
    variantName: "APC truncation cluster",
    markerType: "Indel Panel",
    geneSymbol: "APC",
    geneName: "APC regulator of WNT signaling pathway",
    chromosome: "chr5",
    position: 112175770,
    associatedConditions: ["Colorectal cancer", "Early colorectal neoplasia"],
    cancer: "Colonrector",
    specimen: "Plasma",
    markerClass: "Insertion / Deletion",
    omics: "cfDNA",
    featureType: "Coding truncation",
    collection: "CFD-CO-071",
    element: "Genes",
    geneBiotype: "protein_coding",
    genomeLocation: "chr5, 112043201-112181936, +",
    ensemblId: "ENSG00000134982",
    ncbiId: "324",
    description: "APC truncating events remain among the most informative coding disruptions in colorectal cfDNA variant panels."
  },
  {
    markerDbId: "MDB00595096",
    variantName: "TERT promoter c.-124C>T",
    markerType: "Promoter Variant",
    geneSymbol: "TERT",
    geneName: "Telomerase reverse transcriptase",
    chromosome: "chr5",
    position: 1295228,
    associatedConditions: ["Liver cancer", "High-risk cirrhosis"],
    cancer: "Liver",
    specimen: "Plasma",
    markerClass: "Single Nucleotide Mutation",
    omics: "cfDNA",
    featureType: "Promoter mutation",
    collection: "CFD-LI-029",
    element: "Promoters",
    geneBiotype: "protein_coding",
    genomeLocation: "chr5, 1253147-1295761, -",
    ensemblId: "ENSG00000164362",
    ncbiId: "7015",
    description: "TERT promoter variants can be detected in cfDNA and contribute to liver cancer surveillance signatures."
  },
  {
    markerDbId: "MDB00595097",
    variantName: "PIK3CA p.H1047R",
    markerType: "SNP Panel",
    geneSymbol: "PIK3CA",
    geneName: "Phosphatidylinositol-4,5-bisphosphate 3-kinase catalytic subunit alpha",
    chromosome: "chr3",
    position: 178952085,
    associatedConditions: ["Breast cancer", "Hormone receptor positive breast cancer"],
    cancer: "Breast",
    specimen: "Plasma",
    markerClass: "Single Nucleotide Mutation",
    omics: "cfDNA",
    featureType: "Mutation hotspot",
    collection: "CFD-BR-088",
    element: "Genes",
    geneBiotype: "protein_coding",
    genomeLocation: "chr3, 178866311-178957881, +",
    ensemblId: "ENSG00000121879",
    ncbiId: "5290",
    description: "PIK3CA hotspot profiling supports endocrine resistance stratification and minimal residual disease tracking in breast cohorts."
  },
  {
    markerDbId: "MDB00595098",
    variantName: "SMAD4 loss track",
    markerType: "CNV Marker",
    geneSymbol: "SMAD4",
    geneName: "SMAD family member 4",
    chromosome: "chr18",
    position: 51060038,
    associatedConditions: ["Pancreatic cancer", "Metastatic PDAC"],
    cancer: "Pdac",
    specimen: "Plasma",
    markerClass: "Deletion",
    omics: "cfDNA",
    featureType: "Copy number loss",
    collection: "CFD-PA-014",
    element: "Genes",
    geneBiotype: "protein_coding",
    genomeLocation: "chr18, 51039115-51041725, +",
    ensemblId: "ENSG00000141646",
    ncbiId: "4089",
    description: "SMAD4 loss and copy-number attenuation remain highly informative markers across advanced pancreatic plasma profiling workflows."
  }
];

function delay<T>(value: T, wait = 180) {
  return new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), wait);
  });
}

function normalizeCancerLabel(cancer: string) {
  if (cancer === "Colonrector") return "Colorectal";
  if (cancer === "Pdac") return "Pancreatic";
  return cancer;
}

function makeValues(center: number, spread: number, seed: number) {
  return Array.from({ length: 24 }, (_, index) => {
    const swing = ((index * 7 + seed) % 11) - 5;
    return Number((center + swing * spread).toFixed(1));
  });
}

function buildGroups(record: MarkerRecord) {
  const library: Record<string, { labels: string[]; centers: number[] }> = {
    Breast: {
      labels: ["Benign lesion", "Luminal A", "Luminal B", "HER2+", "TNBC"],
      centers: [18, 22, 25, 27, 24]
    },
    Colonrector: {
      labels: ["Healthy", "Adenoma", "Localized CRC", "Metastatic CRC", "Post-op"],
      centers: [15, 21, 28, 31, 19]
    },
    Liver: {
      labels: ["Healthy", "Chronic HBV", "Cirrhosis", "LIHC", "Post-ablation"],
      centers: [16, 19, 22, 27, 18]
    },
    Lung: {
      labels: ["Healthy", "LUAD", "LUSC", "EGFR mutant", "On-treatment"],
      centers: [14, 23, 26, 30, 21]
    },
    Pdac: {
      labels: ["Healthy", "Pancreatitis", "Localized PDAC", "Metastatic PDAC", "Post-op"],
      centers: [12, 18, 24, 32, 17]
    }
  };
  const template = library[record.cancer] ?? library.Breast;

  return template.labels.map((label, index) => ({
    label,
    values: makeValues(template.centers[index], 1.4 + index * 0.15, record.position % 17),
    color: COLORS[index % COLORS.length]
  }));
}

function buildTrackLanes(record: MarkerRecord): MarkerTrackLane[] {
  const laneLabels = ["RefSeq Select", `${record.geneSymbol} track`, `${record.specimen} signal`];
  return laneLabels.map((label, laneIndex) => ({
    id: `${record.markerDbId}-${laneIndex}`,
    label,
    bars: CHROMOSOMES.map((_, chromIndex) => ((chromIndex * 9 + laneIndex * 7 + record.position) % 17) + (laneIndex === 0 ? 6 : 2))
  }));
}

function buildDetail(record: MarkerRecord): MarkerDetail {
  const profileGroups = buildGroups(record);
  return {
    record,
    version: "2.0",
    createdAt: "2020-08-05 07:07:49 UTC",
    updatedAt: "2026-03-14 18:21:10 UTC",
    organism: "Homo sapiens",
    conditionsHierarchy: ["Cardiovascular / Thoracic Disorder", normalizeCancerLabel(record.cancer), record.associatedConditions[0]],
    sources: ["cfDNA Atlas curated release", "ANNOVAR annotation", "ClinVar / COSMIC harmonized tags"],
    links: [
      { label: "NCBI", url: `https://www.ncbi.nlm.nih.gov/gene/${record.ncbiId}` },
      { label: "Ensembl", url: `https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${record.ensemblId}` },
      { label: "ClinVar", url: "https://www.ncbi.nlm.nih.gov/clinvar/" }
    ],
    omicsOptions: ["cfDNA", "cfRNA", "Proteome"],
    featureTypeOptions: ["Mutation hotspot", "Methylation (BS-seq)", "Fragment Size", "Nucleosomal Occupancy"],
    collectionOptions: [record.collection, "GSE112679", "GSE126676", "GSE152631"],
    specimenOptions: [record.specimen, "Serum", "PBMC"],
    elementOptions: [record.element, "Promoters", "Enhancers"],
    selectedOmics: record.omics,
    selectedFeatureType: record.featureType,
    selectedCollection: record.collection,
    selectedSpecimen: record.specimen,
    selectedElement: record.element,
    profileGroups,
    comparisonGroups: profileGroups.slice(0, 2),
    trackFeatures: [
      "cfDNA Methylation (BS-seq)",
      "cfDNA Fragment Size",
      "cfDNA Nucleosomal Occupancy",
      "cfRNA Align",
      "cfRNA Editing",
      "cfRNA RNA SNP"
    ],
    trackLanes: buildTrackLanes(record),
    selectedFeature: "cfDNA Methylation (BS-seq)",
    selectedChromosome: record.chromosome,
    relatedMarkers: MARKER_RECORDS.filter((item) => item.cancer === record.cancer && item.markerDbId !== record.markerDbId)
      .map((item) => item.markerDbId)
      .slice(0, 4)
  };
}

export function listMarkerRecords() {
  return delay(MARKER_RECORDS);
}

export function getMarkerRecord(markerDbId: string) {
  const record = MARKER_RECORDS.find((item) => item.markerDbId === markerDbId);
  return delay(record ? buildDetail(record) : null);
}
