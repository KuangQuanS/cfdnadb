# cfdnaweb Data Structure Notes

Observed on `fatnode` on 2026-04-21. This file is intended as the local
reference for `/400T/cfdnaweb` so routine backend/frontend changes do not need
fresh SSH inspection just to understand the data layout.

## Runtime Roots

Primary application data root:

```text
/400T/cfdnaweb
```

Backend defaults from `backend/src/main/resources/application.yml`:

```yaml
app.data-dir: /400T/cfdnaweb
app.query-db-file: cfdnadb.duckdb
app.maf-db-file: maf.duckdb
app.tcga-igv-file: /400T/cfdnaweb/tcga_maf.txt
app.pan-cancer-dir: /400T/cfdnaweb/statistics/oncoplot/pan_cancer
app.vaf-data-dir: /400T/cfdnadb/MAF_all/PDF/PAN_cancer/cfDNA_VAF
```

The web app is deployed under `/cfdnadb/`, so frontend bundles must be built
with Vite base `/cfdnadb/`.

## Top-Level Layout

Top-level directories observed under `/400T/cfdnaweb`:

```text
Benign_Tumor
Bladder
Brain
Breast
Cell_Line
Cervical
Colorectal
DataBase
Endometrial
Esophageal
Gastric
HeadAndNeck
Kidney
Liver
Lung
Other
Ovarian
Pancreatic
Thyroid
reference
statistics
```

Top-level generated/query artifacts and helper files:

```text
aggregate_multianno.sh
build_maf_duckdb.sh
cfdnadb.duckdb
cfdnadb.war
migrate.log
tcga_maf.txt
```

`DataBase/` contains additional multi-omics database exports used by the
Survival Analysis page for gene-level boxplots:

```text
DataBase/cfMethDB.txt                    143,675,089
DataBase/cfOmics_methylation.txt          47,017,747
DataBase/ctcRbase_all_cancers_long.txt 1,859,287,689
```

Observed columns:

```text
cfMethDB.txt
  Chrom Start End MeNormal MeCancer pvalue GeneId GeneName Distance2TSS
  Annotation MeDiff Type CancerType Project cancer_type chrom_num pos_mb

cfOmics_methylation.txt
  hgnc_symbol gene_biotype cancer_type methylation_value cancer_name

ctcRbase_all_cancers_long.txt
  Gene Dataset FPKM Cancer_Type
```

Survival Analysis multi-omics endpoints read these files on demand via DuckDB:

```text
/api/survival/multiomics/cfmethdb?gene=TP53
/api/survival/multiomics/cfomics-methylation?gene=TP53
/api/survival/multiomics/ctc-expression?gene=TP53
```

The first two endpoints group methylation values by cancer type. The CTC
endpoint extracts the symbol after the final underscore in `Gene`
(`ENSG..._TSPAN6 -> TSPAN6`), groups FPKM by `Cancer_Type`, and floors non-
positive values to `0.01` for log-scale plotting.

Top-level symlinks:

```text
cfDNA_MAF_Mutations.tsv  -> /400T/cfdnadb/cfDNA_MAF_Mutations.tsv
cfDNA_MAF_Mutations.xlsx -> /400T/cfdnadb/cfDNA_MAF_Mutations.xlsx
maf.duckdb               -> /400T/cfdnadb/maf.duckdb
TCGA_maf_mutation.tsv    -> /400T/cfdnadb/TCGA_maf_mutation.tsv
TCGA_maf_mutation.xlsx   -> /400T/cfdnadb/TCGA_maf_mutation.xlsx
```

## Cohort Directories

Regular cohort directories generally use this shape:

```text
/400T/cfdnaweb/{Cancer}/
  {Cancer}_all_sample_multianno.txt
  private/
  public/
  stats/
  tcga/
```

Observed second-level cohort directories:

```text
Benign_Tumor/private
Benign_Tumor/public
Benign_Tumor/stats
Benign_Tumor/tcga
Bladder/private
Bladder/public
Bladder/stats
Bladder/tcga
Brain/stats
Breast/private
Breast/public
Breast/stats
Breast/tcga
Cell_Line/stats
Cervical/private
Cervical/public
Cervical/stats
Cervical/tcga
Colorectal/private
Colorectal/public
Colorectal/stats
Colorectal/tcga
Endometrial/private
Endometrial/public
Endometrial/stats
Endometrial/tcga
Esophageal/private
Esophageal/public
Esophageal/stats
Esophageal/tcga
Gastric/private
Gastric/public
Gastric/stats
Gastric/tcga
HeadAndNeck/private
HeadAndNeck/public
HeadAndNeck/stats
HeadAndNeck/tcga
Kidney/private
Kidney/public
Kidney/stats
Kidney/tcga
Liver/geo
Liver/private
Liver/public
Liver/stats
Liver/tcga
Lung/private
Lung/public
Lung/stats
Lung/tcga
Other/stats
Ovarian/private
Ovarian/public
Ovarian/stats
Ovarian/tcga
Pancreatic/private
Pancreatic/public
Pancreatic/stats
Pancreatic/tcga
Thyroid/private
Thyroid/public
Thyroid/stats
Thyroid/tcga
statistics/oncoplot
```

Important exceptions:

- `Benign_Tumor` is the current directory name, but its aggregate file is still
  `NGY_all_sample_multianno.txt`.
- `Cell_Line` exists and currently has `stats/`; no top-level
  `Cell_Line_all_sample_multianno.txt` was observed in the sampled aggregate
  list.
- `Brain` and `Other` appear as support/statistics directories rather than full
  cohort import directories.
- `Liver` has a `geo/` directory; GEO data is indexed separately from private
  cfDNA and TCGA data.

## Aggregate Multianno Files

`MafDuckDbImportService` scans aggregate files when rebuilding
`cfdnadb.duckdb`. The import service currently looks for:

```text
/400T/cfdnaweb/{Cancer}/{Cancer}_all_sample_multianno.txt
```

Observed aggregate files and sizes:

```text
Benign_Tumor/NGY_all_sample_multianno.txt             13,993,136
Bladder/Bladder_all_sample_multianno.txt             533,098,199
Breast/Breast_all_sample_multianno.txt             2,734,025,652
Cervical/Cervical_all_sample_multianno.txt             1,049,256
Colorectal/Colorectal_all_sample_multianno.txt       771,167,442
Endometrial/Endometrial_all_sample_multianno.txt         113,480
Esophageal/Esophageal_all_sample_multianno.txt            64,389
Gastric/Gastric_all_sample_multianno.txt              27,988,129
HeadAndNeck/HeadAndNeck_all_sample_multianno.txt       6,054,744
Kidney/Kidney_all_sample_multianno.txt                12,354,901
Liver/Liver_all_sample_multianno.txt                  29,874,352
Lung/Lung_all_sample_multianno.txt                   328,627,966
Ovarian/Ovarian_all_sample_multianno.txt              14,659,696
Pancreatic/Pancreatic_all_sample_multianno.txt       391,650,958
Thyroid/Thyroid_all_sample_multianno.txt                 195,876
```

Backend operational note:

- Aggregate import is performed one cohort file per DuckDB connection to avoid
  DuckDB JDBC native crashes during large transaction commits.
- DuckDB query connections are opened read-only to avoid web-server write
  permission failures on the generated database file.
- Query database rebuilds write to a same-directory temporary file named like
  `cfdnadb.duckdb.importing-{pid}-{timestamp}` first. After all import phases
  and `CHECKPOINT` succeed, the temporary database is moved over
  `cfdnadb.duckdb`. This avoids rebuilding directly against a database file
  that may still be held open by the running web service.

## Files Indexed Into DuckDB

`MafDuckDbImportService.inspectFilesystem()` builds several indexes:

```text
aggregate_multianno
sample_inventory
sample_top_genes
cohort_file_index
statistics_asset_index
```

Input locations:

```text
/400T/cfdnaweb/cfDNA_MAF_Mutations.tsv
/400T/cfdnaweb/TCGA_maf_mutation.tsv
/400T/cfdnaweb/tcga_maf.txt
/400T/cfdnaweb/{Cancer}/{Cancer}_all_sample_multianno.txt
/400T/cfdnaweb/{Cancer}/private/**
/400T/cfdnaweb/{Cancer}/public/**
/400T/cfdnaweb/{Cancer}/tcga/**
/400T/cfdnaweb/{Cancer}/geo/**
/400T/cfdnaweb/{Cancer}/stats/**
/400T/cfdnaweb/statistics/oncoplot/pan_cancer/clinical_data.txt
/400T/cfdnaweb/statistics/oncoplot/pan_cancer/mutations_data.txt
```

Statistics assets are collected from:

```text
/400T/cfdnaweb/{Cancer}/private/stats
/400T/cfdnaweb/{Cancer}/public/stats
/400T/cfdnaweb/{Cancer}/tcga/stats
/400T/cfdnaweb/{Cancer}/geo/stats
/400T/cfdnaweb/{Cancer}/stats
```

Gene lollipop plots are expected below `lollipop` categories and parsed from
file names into gene/chromosome/start/end metadata.

## Cohort Naming

Current imported/queryable cohort names in Java:

```text
Breast
Colorectal
Liver
Lung
Pancreatic
Bladder
Cervical
Endometrial
Esophageal
Gastric
HeadAndNeck
Kidney
Ovarian
Thyroid
Benign_Tumor
Cell_Line
```

Important legacy/source aliases:

```text
CRC             -> Colorectal
PDAC            -> Pancreatic
Endometrium     -> Endometrial
Head_and_neck   -> HeadAndNeck
Thyriod         -> Thyroid
NGY             -> Benign_Tumor
Experiment      -> Cell_Line
```

These aliases appear in different source files, so query/import code should
avoid assuming every on-disk file already uses the current display cohort name.

## VAF Statistics Directory

Configured backend property:

```text
/400T/cfdnadb/MAF_all/PDF/PAN_cancer/cfDNA_VAF
```

Observed `*_VAF_statistics.txt` files:

```text
Bladder_VAF_statistics.txt
Breast_VAF_statistics.txt
Cervical_VAF_statistics.txt
Colonrector_VAF_statistics.txt
EGA_VAF_statistics.txt
Endometrium_VAF_statistics.txt
Esophageal_VAF_statistics.txt
Experiment_VAF_statistics.txt
Gastric_VAF_statistics.txt
GEO_Bladder_VAF_statistics.txt
GEO_Colonrector_VAF_statistics.txt
GEO_Liver_VAF_statistics.txt
Head_and_Neck_VAF_statistics.txt
Kidney_VAF_statistics.txt
Liver_VAF_statistics.txt
Lung_VAF_statistics.txt
NGY_VAF_statistics.txt
Others_VAF_statistics.txt
Ovarian_VAF_statistics.txt
Pdac_VAF_statistics.txt
Thyriod_VAF_statistics.txt
```

The VAF directory still contains legacy names. The backend normalizes these
when serving `/api/v1/statistics/vaf-distribution`:

```text
Colonrector   -> Colorectal
Endometrium   -> Endometrial
Experiment    -> Cell_Line
Head_and_Neck -> HeadAndNeck
NGY           -> Benign_Tumor
Pdac          -> Pancreatic
Thyriod       -> Thyroid
```

GEO-prefixed VAF files are excluded from the cfDNA VAF distribution endpoint.
`Cell_Line` is not excluded; the legacy `Experiment_VAF_statistics.txt` file is
included and reported as `Cell_Line`.

## Deployment Notes

WAR artifact:

```text
/400T/cfdnaweb/cfdnadb.war
/webapps/apache-tomcat-9.0.96/webapps/cfdnadb.war
```

Those paths have been observed as separate files, not symlinks. If deploying
manually, ensure the Tomcat `webapps/cfdnadb.war` path receives the new WAR.

Frontend asset paths must include `/cfdnadb/`:

```html
<script src="/cfdnadb/assets/...js"></script>
<link href="/cfdnadb/assets/...css" rel="stylesheet">
```

If generated as `/assets/...`, the deployed site will request
`https://leelab.kmmu.edu.cn/assets/...` and return 404.
