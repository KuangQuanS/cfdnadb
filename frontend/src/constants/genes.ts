// Common cancer driver genes and frequently mutated genes
// Used for instant autocomplete suggestions in gene search inputs
export const COMMON_CANCER_GENES: string[] = [
  // Tumor suppressors
  "TP53", "PTEN", "RB1", "APC", "VHL", "BRCA1", "BRCA2", "CDKN2A", "CDKN2B",
  "NF1", "NF2", "MLH1", "MSH2", "MSH6", "PMS2", "ATM", "CHEK2", "PALB2",
  "STK11", "SMAD4", "SMAD2", "TGFbeta", "BAP1", "ARID1A", "ARID2", "KDM6A",
  "FBXW7", "TSC1", "TSC2", "WT1", "PTCH1", "AXIN1", "AXIN2", "FAT1",
  // Oncogenes
  "KRAS", "NRAS", "HRAS", "BRAF", "EGFR", "ERBB2", "ERBB3", "MET", "ALK",
  "RET", "ROS1", "FGFR1", "FGFR2", "FGFR3", "FGFR4", "PDGFRA", "PDGFRB",
  "KIT", "FLT3", "ABL1", "JAK1", "JAK2", "JAK3", "STAT3", "STAT5A", "STAT5B",
  "PIK3CA", "PIK3CB", "PIK3CD", "PIK3CG", "AKT1", "AKT2", "AKT3", "MTOR",
  "MYC", "MYCN", "MYCL", "CCND1", "CCND2", "CCND3", "CDK4", "CDK6",
  "MDM2", "MDM4", "BCL2", "BCL6", "MCL1", "BIRC5",
  // Chromatin remodeling
  "DNMT3A", "DNMT3B", "IDH1", "IDH2", "TET2", "EZH2", "ASXL1", "ASXL2",
  "KMT2A", "KMT2B", "KMT2C", "KMT2D", "SETD2", "KDM5C",
  // Colorectal specific
  "KRAS", "NRAS", "BRAF", "APC", "SMAD4", "PIK3CA", "FBXW7",
  // Breast specific
  "ESR1", "PGR", "FOXA1", "GATA3", "CDH1", "MAP3K1", "MAP2K4",
  // Lung specific
  "KEAP1", "NFE2L2", "STK11", "RBM10", "U2AF1",
  // Liver specific
  "CTNNB1", "TERT", "ARID2", "NFE2L2", "KEAP1",
  // Pancreas specific
  "SMAD4", "CDKN2A", "GNAS", "RNF43",
  // Cell cycle
  "TP53", "CDKN1A", "CDKN1B", "CDKN2A", "MDM2", "CCNE1", "CDC73",
  // Splicing
  "SF3B1", "SRSF2", "U2AF1", "ZRSR2",
  // Signal transduction
  "NOTCH1", "NOTCH2", "NOTCH3", "NOTCH4", "HIF1A", "VEGFA", "FGF19",
  "MAPK1", "MAPK3", "MAP2K1", "MAP2K2", "RAF1",
  // DNA repair
  "RAD51", "RAD51B", "RAD51C", "RAD51D", "BRIP1", "FANCA", "FANCC",
  // cfDNA commonly mutated
  "MUC16", "MUC4", "MUC12", "OBSCN", "TTN", "CSMD3", "CSMD1",
  "RYR2", "RYR3", "DNAH5", "DNAH11", "FLG", "SYNE1", "SYNE2",
  "ZFHX4", "LRRTM4", "PCLO", "XIRP2", "COL11A1", "COL12A1",
  "EPPK1", "HRNR", "DST", "PLEC", "HMCN1", "HMCN2",
  // Pan-cancer drivers
  "TERT", "CTNNB1", "CREBBP", "EP300", "SPOP", "FOXA1",
  "SOX9", "SOX2", "SOX17", "RUNX1", "RUNX3",
  "PTPRT", "PTPRD", "PTPRS", "LRP1B", "LRP6",
].filter((value, index, self) => self.indexOf(value) === index).sort();
