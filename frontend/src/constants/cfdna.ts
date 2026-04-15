export const CANCER_OPTIONS = [
  "Breast", "Colorectal", "Liver", "Lung", "Pancreatic",
  "Bladder", "Cervical", "Endometrial", "Esophageal", "Gastric",
  "HeadAndNeck", "Kidney", "Ovarian", "Thyroid", "NGY",
] as const;

export const DEFAULT_CANCER = "Breast";
export const DEFAULT_GENE = "TP53";

export const HERO_QUICK_LINKS = [
  { label: "Breast TP53", cancer: "Breast", gene: "TP53" },
  { label: "Colorectal KRAS", cancer: "Colorectal", gene: "KRAS" },
  { label: "Lung EGFR", cancer: "Lung", gene: "EGFR" }
] as const;

export type CancerOption = typeof CANCER_OPTIONS[number];
