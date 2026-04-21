# cfdnaweb Data Structure Notes

Observed on `fatnode` on 2026-04-21.

## Primary Data Root

Application data root:

```text
/400T/cfdnaweb
```

Top-level cohort and support directories observed:

```text
Benign_Tumor
Bladder
Brain
Breast
Cell_Line
Cervical
Colorectal
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

Top-level files include generated/query artifacts such as:

```text
cfdnadb.duckdb
cfdnadb.war
cfDNA_MAF_Mutations.tsv -> /400T/cfdnadb/cfDNA_MAF_Mutations.tsv
TCGA_maf_mutation.tsv -> /400T/cfdnadb/TCGA_maf_mutation.tsv
tcga_maf.txt
maf.duckdb -> /400T/cfdnadb/maf.duckdb
```

The DuckDB import service scans cohort directories listed in
`MafDuckDbImportService.CANCERS`. As of this note, that list includes both
`Benign_Tumor` and `Cell_Line`.

## VAF Statistics Directory

Configured backend property:

```yaml
app.vaf-data-dir: /400T/cfdnadb/MAF_all/PDF/PAN_cancer/cfDNA_VAF
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

The VAF directory still contains legacy names that do not match current
cohort directory names. The backend normalizes these when serving
`/api/v1/statistics/vaf-distribution`:

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

## Operational Notes

- The web app is deployed under `/cfdnadb/`, so frontend bundles must be built
  with Vite base `/cfdnadb/`.
- `cfdnadb.duckdb` is the query database used by the web backend.
- DuckDB query connections are opened read-only to avoid web-server write
  permission failures on the generated database file.
- Aggregate import is performed one cohort file per DuckDB connection to avoid
  DuckDB JDBC native crashes during large transaction commits.
