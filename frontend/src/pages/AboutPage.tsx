import { Link } from "react-router-dom";

export function AboutPage() {
  return (
    <div className="page-stack">

      <section>
        <p className="section-eyebrow">About</p>
        <h2 style={{ fontSize: "2.2rem", color: "var(--accent)", margin: "8px 0 16px" }}>cfDNA Atlas</h2>
        <p style={{ fontSize: "1.15rem", color: "var(--muted)", maxWidth: 760, lineHeight: 1.8 }}>
          A curated academic database of somatic mutations identified from circulating cell-free DNA (cfDNA) in plasma across multiple cancer cohorts. Built to accelerate liquid biopsy research, biomarker discovery, and cross-cohort comparative genomics.
        </p>
        <div className="badge-row" style={{ marginTop: 20 }}>
          <span className="badge">hg38</span>
          <span className="badge">ANNOVAR</span>
          <span className="badge">MuTect2</span>
          <span className="badge warm">Liquid biopsy</span>
          <span className="badge green">Open access</span>
        </div>
      </section>

      <div className="detail-grid">
        {/* Citation */}
        <section className="detail-card prose-block">
          <p className="section-eyebrow">Citation</p>
          <h3>How to cite</h3>
          <p>
            If you use cfDNA Atlas in published research, please cite the following:
          </p>
          <div className="citation-block">
            Lee Lab. cfDNA Atlas: a multi-cohort somatic variant database for circulating cell-free DNA research.
            Kunming Medical University. 2025. https://leelab.kmmu.edu.cn/cfdnadb/
          </div>
          <p>
            For cohort-specific analyses, please also acknowledge the individual sequencing datasets and the pipeline tools (MuTect2, ANNOVAR) according to their respective citation guidelines.
          </p>
        </section>

        {/* Data */}
        <section className="detail-card prose-block">
          <p className="section-eyebrow">Data</p>
          <h3>Database content</h3>
          <p>
            cfDNA Atlas currently contains somatic variant calls from five cancer cohorts: breast carcinoma, colorectal adenocarcinoma, hepatocellular carcinoma, non-small cell lung cancer, and pancreatic ductal adenocarcinoma (PDAC). Variants are derived from targeted panel or whole-exome sequencing of plasma-isolated cfDNA.
          </p>
          <p>
            All variant records include chromosomal coordinates (hg38), reference and alternate alleles, functional region annotation (Func.refGene), exonic consequence (ExonicFunc.refGene), amino acid change (AAChange.refGene), and tumor sample barcode. Per-cohort aggregate files are available for download.
          </p>
        </section>
      </div>

      <section className="detail-card prose-block">
        <p className="section-eyebrow">Methods</p>
        <h3>Bioinformatics pipeline</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
          <div>
            <h3>Sequencing and alignment</h3>
            <p>
              Plasma-derived cfDNA was extracted and subjected to targeted panel sequencing or whole-exome sequencing. Raw reads were aligned to the human reference genome (GRCh38/hg38) using BWA-MEM. Duplicate reads were marked using Picard MarkDuplicates and base quality score recalibration (BQSR) was applied using GATK4.
            </p>
            <h3>Somatic variant calling</h3>
            <p>
              Somatic single nucleotide variants (SNVs) and small insertions/deletions (indels) were identified using MuTect2 in tumor-only mode with a panel of normals (PoN) constructed from matched normal samples. Variants were filtered using FilterMutectCalls with default GATK4 parameters and cohort-level contamination estimates derived from GetPileupSummaries and CalculateContamination.
            </p>
          </div>
          <div>
            <h3>Variant annotation</h3>
            <p>
              Filtered VCF files were converted to ANNOVAR input format and annotated against multiple databases: UCSC refGene (hg38) for gene-level functional consequence, ExAC and gnomAD for population allele frequencies, the 1000 Genomes Project for common variant filtering, and ClinVar for clinical significance. Exonic variants are classified according to standard ANNOVAR nomenclature (nonsynonymous SNV, synonymous SNV, stopgain, frameshift deletion/insertion, etc.).
            </p>
            <h3>Aggregation and query layer</h3>
            <p>
              Per-sample annotated multianno files were concatenated into cohort-level aggregate TSV files. The query layer uses embedded DuckDB JDBC to execute SQL against these flat files without a separate database server, enabling fast gene-centric lookups and aggregation queries directly on the filesystem.
            </p>
          </div>
        </div>
      </section>

      <section className="detail-card prose-block">
        <p className="section-eyebrow">Terms of use</p>
        <h3>Data access and usage policy</h3>
        <p>
          All data in cfDNA Atlas is made available for academic and non-commercial research use. Redistribution or commercial use of the raw data requires prior written permission from the Lee Laboratory. Users are responsible for compliance with applicable data protection regulations and institutional review board requirements for their jurisdiction.
        </p>
        <p>
          The variant calls provided represent computational predictions derived from a standardized bioinformatics pipeline. They have not been individually validated by orthogonal methods. Users should perform appropriate validation before reporting findings in a clinical context.
        </p>
        <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
          <Link to="/downloads" className="button-secondary inline-button">Access data files</Link>
          <Link to="/browse" className="button-secondary inline-button">Browse variants</Link>
        </div>
      </section>

      <section className="detail-card prose-block">
        <p className="section-eyebrow">Contact</p>
        <h3>Lee Laboratory</h3>
        <p>
          Department of Oncology, Kunming Medical University<br />
          Kunming, Yunnan, China<br />
          Web: <a href="https://leelab.kmmu.edu.cn/">leelab.kmmu.edu.cn</a>
        </p>
        <p>
          For questions about the database, data access requests, or collaboration inquiries, please contact the laboratory directly through the institutional website.
        </p>
      </section>

    </div>
  );
}
