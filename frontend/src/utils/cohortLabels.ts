const COHORT_LABELS: Record<string, string> = {
  Benign_Tumor: "Benign Tumor",
  NGY: "Benign Tumor",
  Cell_Line: "Gastric",
  Experiment: "Gastric",
  HeadAndNeck: "Head & Neck",
  Head_and_neck: "Head & Neck",
  CRC: "Colorectal",
  PDAC: "Pancreatic",
  Pdac: "Pancreatic",
  Endometrium: "Endometrial",
  Thyriod: "Thyroid"
};

export function formatCohortLabel(value: string | null | undefined): string {
  if (!value) return "-";
  return COHORT_LABELS[value] ?? value.replace(/_/g, " ");
}
