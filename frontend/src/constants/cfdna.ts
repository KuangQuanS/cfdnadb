export const CANCER_OPTIONS = [
  "Bladder", "Brain", "Breast", "Cervical", "Colorectal",
  "Endometrial", "Esophageal", "Gastric", "HeadAndNeck", "Kidney",
  "Liver", "Lung", "Ovarian", "Pancreatic", "Thyroid", "Benign_Tumor",
] as const;

export const DEFAULT_CANCER = "Breast";
export const DEFAULT_GENE = "TP53";

export const HERO_QUICK_LINKS = [
  { label: "Breast TP53", cancer: "Breast", gene: "TP53" },
  { label: "Colorectal KRAS", cancer: "Colorectal", gene: "KRAS" },
  { label: "Lung EGFR", cancer: "Lung", gene: "EGFR" }
] as const;

export type CancerOption = typeof CANCER_OPTIONS[number];
