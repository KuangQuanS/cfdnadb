package org.cfdna.database.service;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.PushbackInputStream;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class MafDuckDbImportService {

    private static final Logger log = LoggerFactory.getLogger(MafDuckDbImportService.class);

    private static final String CFDNA_TSV = "cfDNA_MAF_Mutations.tsv";
    private static final String TCGA_TSV = "TCGA_maf_mutation.tsv";
    private static final String QUERY_DB_DEFAULT_FILE = "cfdnadb.duckdb";
    private static final String PAN_CANCER_CLINICAL_FILE = "clinical_data.txt";
    private static final String PAN_CANCER_MUTATIONS_FILE = "mutations_data.txt";
    private static final int JDBC_BATCH_SIZE = 1_000;
    private static final List<String> CANCERS = List.of(
            "Breast", "Colorectal", "Liver", "Lung", "Pancreatic",
            "Bladder", "Cervical", "Endometrial", "Esophageal", "Gastric",
            "HeadAndNeck", "Kidney", "Ovarian", "Thyroid", "Benign_Tumor", "Cell_Line");
    private static final List<String> REQUIRED_AGGREGATE_COLUMNS = List.of(
            "Chr", "Start", "End", "Ref", "Alt",
            "Func.refGene", "Gene.refGene", "ExonicFunc.refGene",
            "AAChange.refGene", "Tumor_Sample_Barcode");

    private final Path dataDir;
    private final Path panCancerDir;
    private final String queryDbFileName;

    public MafDuckDbImportService(@Value("${app.data-dir:/400T/cfdnadb}") String dataDir,
                                  @Value("${app.pan-cancer-dir:/400T/cfdnadb/statistics/oncoplot/pan_cancer}") String panCancerDir,
                                  @Value("${app.query-db-file:${app.maf-db-file:cfdnadb.duckdb}}") String queryDbFileName) {
        this.dataDir = Path.of(dataDir);
        this.panCancerDir = Path.of(panCancerDir);
        this.queryDbFileName = queryDbFileName == null || queryDbFileName.isBlank()
                ? QUERY_DB_DEFAULT_FILE
                : queryDbFileName;
    }

    public Path rebuildDatabase() {
        Path dbPath = dataDir.resolve(queryDbFileName).toAbsolutePath();
        Path cfDnaPath = requireFile(dataDir.resolve(CFDNA_TSV).toAbsolutePath(), "cfDNA MAF TSV");
        Path tcgaPath = requireFile(dataDir.resolve(TCGA_TSV).toAbsolutePath(), "TCGA MAF TSV");
        Path panClinical = panCancerDir.resolve(PAN_CANCER_CLINICAL_FILE).toAbsolutePath();
        Path panMutations = panCancerDir.resolve(PAN_CANCER_MUTATIONS_FILE).toAbsolutePath();

        try {
            Files.createDirectories(dataDir);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to create data directory " + dataDir, exception);
        }

        ImportPlan plan = inspectFilesystem(panClinical, panMutations);
        try {
            Files.deleteIfExists(dbPath);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to clean old query database files near " + dbPath, exception);
        }

        log.info("[QUERY-IMPORT] building {} with aggregates={}, samples={}, cohortFiles={}, assets={}",
                dbPath,
                plan.aggregateFiles.size(),
                plan.sampleRows.size(),
                plan.cohortFileRows.size(),
                plan.assetRows.size());

        String jdbcUrl = "jdbc:duckdb:" + dbPath;

        // Phase 1: create tables & import MAF data (separate connections to avoid DuckDB JNI SIGSEGV in long transactions)
        long cfdnaRows, tcgaRows, geoRows;
        try (Connection conn = DriverManager.getConnection(jdbcUrl)) {
            conn.setAutoCommit(false);
            recreateTables(conn);
            conn.commit();
            log.info("[QUERY-IMPORT] phase 1/5: tables created");
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to create tables in " + dbPath, e);
        }

        // Phase 2: import MAF data - each source in its own connection
        try (Connection conn = DriverManager.getConnection(jdbcUrl)) {
            conn.setAutoCommit(false);
            cfdnaRows = importCfDna(conn, cfDnaPath);
            conn.commit();
            log.info("[QUERY-IMPORT] phase 2a/5: cfdna_maf={}", cfdnaRows);
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to import cfDNA MAF into " + dbPath, e);
        }
        try (Connection conn = DriverManager.getConnection(jdbcUrl)) {
            conn.setAutoCommit(false);
            tcgaRows = importTcga(conn, tcgaPath);
            conn.commit();
            log.info("[QUERY-IMPORT] phase 2b/5: tcga_maf={}", tcgaRows);
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to import TCGA MAF into " + dbPath, e);
        }
        try (Connection conn = DriverManager.getConnection(jdbcUrl)) {
            conn.setAutoCommit(false);
            geoRows = importGeo(conn);
            conn.commit();
            log.info("[QUERY-IMPORT] phase 2c/5: geo_maf={}", geoRows);
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to import GEO MAF into " + dbPath, e);
        }

        // Phase 3: aggregates, pan-cancer, sample inventory
        long aggregateRows, panClinicalRows, panMutationRows;
        try (Connection conn = DriverManager.getConnection(jdbcUrl)) {
            conn.setAutoCommit(false);
            aggregateRows = importAggregateFiles(conn, plan.aggregateFiles);
            panClinicalRows = importPanCancerFile(conn, panClinical, "pan_cancer_clinical");
            panMutationRows = importPanCancerFile(conn, panMutations, "pan_cancer_mutations");
            insertSampleInventory(conn, plan.sampleRows);
            insertSampleTopGenes(conn, plan.sampleTopGeneRows);
            conn.commit();
            log.info("[QUERY-IMPORT] phase 3/5: aggregates={}, pan_clinical={}, pan_mutations={}", aggregateRows, panClinicalRows, panMutationRows);
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to import aggregates/samples into " + dbPath, e);
        }

        // Phase 4: enrich TCGA, cohort files, statistics assets
        try (Connection conn = DriverManager.getConnection(jdbcUrl)) {
            conn.setAutoCommit(false);
            enrichTcgaSamples(conn);
            insertCohortFileIndex(conn, plan.cohortFileRows);
            insertStatisticsAssetIndex(conn, plan.assetRows);
            conn.commit();
            log.info("[QUERY-IMPORT] phase 4/5: enrichment & file indexes done");
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to enrich/index data in " + dbPath, e);
        }

        // Phase 5: indexes & ANALYZE
        try (Connection conn = DriverManager.getConnection(jdbcUrl)) {
            conn.setAutoCommit(false);
            createIndexes(conn);
            conn.commit();
            log.info("[QUERY-IMPORT] phase 5/5: indexes created");
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to create indexes in " + dbPath, e);
        }

        log.info("[QUERY-IMPORT] finished db={}, cfdna_maf={}, tcga_maf={}, geo_maf={}", dbPath, cfdnaRows, tcgaRows, geoRows);
        return dbPath;
    }

    private ImportPlan inspectFilesystem(Path panClinical, Path panMutations) {
        ImportPlan plan = new ImportPlan();
        if (!Files.isRegularFile(panClinical)) {
            log.warn("[QUERY-IMPORT] pan-cancer clinical file missing: {}", panClinical);
        }
        if (!Files.isRegularFile(panMutations)) {
            log.warn("[QUERY-IMPORT] pan-cancer mutations file missing: {}", panMutations);
        }

        for (String cancer : CANCERS) {
            Path aggregateFile = dataDir.resolve(cancer).resolve(cancer + "_all_sample_multianno.txt").toAbsolutePath();
            if (Files.isRegularFile(aggregateFile)) {
                validateAggregateColumns(aggregateFile);
                plan.aggregateFiles.add(new AggregateFile(cancer, aggregateFile));
            }
            inspectCancerFiles(cancer, plan);
        }

        for (SampleRow row : plan.sampleRows.values()) {
            int rank = 1;
            for (Map.Entry<String, Long> entry : row.topGenes.entrySet()) {
                plan.sampleTopGeneRows.add(new SampleTopGeneRow(
                        row.cancerType,
                        row.source,
                        row.sampleId,
                        entry.getKey(),
                        entry.getValue(),
                        rank++));
            }
        }
        return plan;
    }

    private void inspectCancerFiles(String cancer, ImportPlan plan) {
        for (String source : List.of("private", "public")) {
            Path sourceDir = dataDir.resolve(cancer).resolve(source);
            collectSampleFiles(plan, cancer, source, sourceDir.resolve("avinput"), "avinput");
            collectSampleFiles(plan, cancer, source, sourceDir.resolve("multianno"), "multianno");
            collectSampleFiles(plan, cancer, source, sourceDir.resolve("vcf"), "vcf");
            collectSampleFiles(plan, cancer, source, sourceDir.resolve("filtered_vcf"), "vcf");
        }

        // GEO: scan {cancer}/geo/{GSE*}/ for sample-level files
        Path geoBaseDir = dataDir.resolve(cancer).resolve("geo");
        if (Files.isDirectory(geoBaseDir)) {
            try (Stream<Path> datasets = Files.list(geoBaseDir)) {
                datasets.filter(Files::isDirectory)
                        .filter(p -> p.getFileName().toString().startsWith("GSE"))
                        .sorted()
                        .forEach(dseDir -> {
                            collectSampleFiles(plan, cancer, "geo", dseDir.resolve("avinput"), "avinput");
                            collectSampleFiles(plan, cancer, "geo", dseDir.resolve("multianno"), "multianno");
                            collectSampleFiles(plan, cancer, "geo", dseDir.resolve("vcf"), "vcf");
                        });
            } catch (IOException e) {
                log.warn("[QUERY-IMPORT] failed to scan GEO dirs for {}: {}", cancer, e.getMessage());
            }
        }

        Path mutationsFile = dataDir.resolve(cancer).resolve(cancer + "_mutations.txt");
        if (Files.isRegularFile(mutationsFile)) {
            plan.cohortFileRows.add(new CohortFileRow(
                    cancer,
                    "Summary",
                    "mutations",
                    mutationsFile.getFileName().toString(),
                    humanizeFileName(mutationsFile.getFileName().toString()),
                    null,
                    mutationsFile.toAbsolutePath(),
                    safeFileSize(mutationsFile)));
        }

        collectStatisticsAssets(plan, cancer, "private", dataDir.resolve(cancer).resolve("private").resolve("stats"));
        collectStatisticsAssets(plan, cancer, "public", dataDir.resolve(cancer).resolve("public").resolve("stats"));
        collectStatisticsAssets(plan, cancer, "tcga", dataDir.resolve(cancer).resolve("tcga").resolve("stats"));
        collectStatisticsAssets(plan, cancer, "geo", dataDir.resolve(cancer).resolve("geo").resolve("stats"));
        collectStatisticsAssets(plan, cancer, "Overview", dataDir.resolve(cancer).resolve("stats"));
        collectTcgaSamples(plan, cancer);
        collectGeoSamples(plan, cancer);
    }

    private void collectSampleFiles(ImportPlan plan, String cancer, String source, Path directory, String category) {
        if (!Files.isDirectory(directory)) {
            return;
        }
        try (Stream<Path> stream = Files.walk(directory)) {
            stream.filter(Files::isRegularFile)
                    .sorted()
                    .forEach(path -> {
                        String fileName = path.getFileName().toString();
                        String sampleId = extractSampleId(fileName, category);
                        if (sampleId == null || sampleId.isBlank()) {
                            return;
                        }

                        SampleKey key = new SampleKey(cancer, source, sampleId.trim());
                        SampleRow row = plan.sampleRows.computeIfAbsent(key, ignored -> new SampleRow(cancer, source, sampleId.trim()));
                        if ("multianno".equals(category)) {
                            row.annoFileName = fileName;
                            row.annoFilePath = path.toAbsolutePath();
                            row.hasAnnotated = true;
                            row.variantCount = countDataRows(path);
                            row.topGenes.clear();
                            row.topGenes.putAll(readTopGenes(path));
                        } else if ("vcf".equals(category)) {
                            row.vcfFileName = fileName;
                            row.vcfFilePath = path.toAbsolutePath();
                            row.hasSomatic = true;
                        } else if ("avinput".equals(category)) {
                            row.avinputFileName = fileName;
                            row.avinputFilePath = path.toAbsolutePath();
                        }

                        plan.cohortFileRows.add(new CohortFileRow(
                                cancer,
                                source,
                                category,
                                fileName,
                                humanizeFileName(fileName),
                                sampleId.trim(),
                                path.toAbsolutePath(),
                                safeFileSize(path)));
                    });
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to inspect sample files under " + directory, exception);
        }
    }

    private void collectTcgaSamples(ImportPlan plan, String cancer) {
        for (String sampleId : readTcgaSampleBarcodes(cancer)) {
            if (sampleId == null || sampleId.isBlank()) {
                continue;
            }
            plan.sampleRows.computeIfAbsent(
                    new SampleKey(cancer, "tcga", sampleId.trim()),
                    ignored -> new SampleRow(cancer, "tcga", sampleId.trim()));
        }
    }

    private void collectGeoSamples(ImportPlan plan, String cancer) {
        Path geoBaseDir = dataDir.resolve(cancer).resolve("geo");
        if (!Files.isDirectory(geoBaseDir)) {
            return;
        }
        try (Stream<Path> datasets = Files.list(geoBaseDir)) {
            datasets.filter(Files::isDirectory)
                    .filter(p -> p.getFileName().toString().startsWith("GSE"))
                    .sorted()
                    .forEach(dseDir -> {
                        Path annoFile = null;
                        try (Stream<Path> files = Files.list(dseDir)) {
                            annoFile = files.filter(Files::isRegularFile)
                                    .filter(p -> p.getFileName().toString().endsWith("_anno.txt"))
                                    .findFirst().orElse(null);
                        } catch (IOException ignored) {
                        }
                        if (annoFile == null) {
                            return;
                        }
                        try (BufferedReader reader = Files.newBufferedReader(annoFile, StandardCharsets.UTF_8)) {
                            String header = reader.readLine();
                            if (header == null) return;
                            String[] cols = header.split("\t");
                            int barcodeIdx = -1;
                            for (int i = 0; i < cols.length; i++) {
                                if ("Tumor_Sample_Barcode".equals(cols[i].trim())) {
                                    barcodeIdx = i;
                                    break;
                                }
                            }
                            if (barcodeIdx < 0) return;
                            java.util.Set<String> seen = new java.util.HashSet<>();
                            String line;
                            while ((line = reader.readLine()) != null) {
                                String[] parts = line.split("\t");
                                if (parts.length > barcodeIdx) {
                                    String sampleId = parts[barcodeIdx].trim();
                                    if (!sampleId.isEmpty() && seen.add(sampleId)) {
                                        plan.sampleRows.computeIfAbsent(
                                                new SampleKey(cancer, "geo", sampleId),
                                                ignored -> new SampleRow(cancer, "geo", sampleId));
                                    }
                                }
                            }
                        } catch (IOException e) {
                            log.warn("[QUERY-IMPORT] failed to read GEO samples from {}: {}", annoFile, e.getMessage());
                        }
                    });
        } catch (IOException e) {
            log.warn("[QUERY-IMPORT] failed to scan GEO dirs for {}: {}", cancer, e.getMessage());
        }
    }

    private void collectStatisticsAssets(ImportPlan plan, String cancer, String source, Path statsDir) {
        if (!Files.isDirectory(statsDir)) {
            return;
        }

        try (Stream<Path> stream = Files.walk(statsDir)) {
            stream.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".pdf"))
                    .sorted()
                    .forEach(path -> {
                        String relativeCategory = toRelativeCategory(cancer, path.getParent());
                        if (isLollipopCategory(relativeCategory)) {
                            return;
                        }
                        String fileName = path.getFileName().toString();
                        plan.assetRows.add(new AssetRow(
                                cancer,
                                source,
                                "cancer_asset",
                                relativeCategory,
                                humanizeFileName(fileName),
                                fileName,
                                path.toAbsolutePath(),
                                safeFileSize(path),
                                null,
                                null,
                                null,
                                null));
                    });
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to inspect statistics assets under " + statsDir, exception);
        }

        try (Stream<Path> direct = Files.list(statsDir)) {
            direct.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".pdf"))
                    .sorted()
                    .forEach(path -> {
                        String fileName = path.getFileName().toString();
                        plan.assetRows.add(new AssetRow(
                                cancer,
                                source,
                                "statistics_plot",
                                toRelativeCategory(cancer, path.getParent()),
                                humanizeFileName(fileName),
                                fileName,
                                path.toAbsolutePath(),
                                safeFileSize(path),
                                null,
                                null,
                                null,
                                null));
                    });
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to inspect statistics plot root " + statsDir, exception);
        }

        Path lollipopDir = statsDir.resolve("lollipop");
        if (!Files.isDirectory(lollipopDir)) {
            return;
        }
        try (Stream<Path> stream = Files.list(lollipopDir)) {
            stream.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".pdf"))
                    .sorted()
                    .forEach(path -> {
                        AssetRow row = parseGenePlotAsset(cancer, source, path);
                        if (row != null) {
                            plan.assetRows.add(row);
                        }
                    });
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to inspect gene plots under " + lollipopDir, exception);
        }
    }

    private AssetRow parseGenePlotAsset(String cancer, String source, Path path) {
        String fileName = path.getFileName().toString();
        String stem = fileName.substring(0, fileName.length() - ".pdf".length());
        String geneName = null;
        String chromosome = null;
        String startPosition = null;
        String endPosition = null;

        if (stem.startsWith("lollipop_CFDNA_")) {
            String[] parts = stem.split("_");
            if (parts.length >= 7) {
                geneName = parts[3];
                chromosome = parts[4];
                startPosition = parts[5];
                endPosition = parts[6];
            }
        } else if (stem.startsWith("lollipop_")) {
            geneName = stem.substring("lollipop_".length());
        }

        if (geneName == null || geneName.isBlank()) {
            return null;
        }

        return new AssetRow(
                cancer,
                source,
                "gene_plot",
                toRelativeCategory(cancer, path.getParent()),
                humanizeFileName(fileName),
                fileName,
                path.toAbsolutePath(),
                safeFileSize(path),
                geneName,
                chromosome,
                startPosition,
                endPosition);
    }

    private void recreateTables(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("DROP TABLE IF EXISTS cfdna_maf");
            statement.execute("DROP TABLE IF EXISTS tcga_maf");
            statement.execute("DROP TABLE IF EXISTS geo_maf");
            statement.execute("DROP TABLE IF EXISTS aggregate_multianno");
            statement.execute("DROP TABLE IF EXISTS pan_cancer_clinical");
            statement.execute("DROP TABLE IF EXISTS pan_cancer_mutations");
            statement.execute("DROP TABLE IF EXISTS sample_inventory");
            statement.execute("DROP TABLE IF EXISTS sample_top_genes");
            statement.execute("DROP TABLE IF EXISTS cohort_file_index");
            statement.execute("DROP TABLE IF EXISTS statistics_asset_index");

            statement.execute(
                    "CREATE TABLE cfdna_maf (" +
                            "cancer_type VARCHAR, chromosome VARCHAR, start_position VARCHAR, end_position VARCHAR, " +
                            "reference_allele VARCHAR, tumor_seq_allele2 VARCHAR, tumor_sample_barcode VARCHAR, " +
                            "hugo_symbol VARCHAR, variant_classification VARCHAR, transcript VARCHAR, exon VARCHAR, " +
                            "tx_change VARCHAR, aa_change VARCHAR, variant_type VARCHAR, functional_region VARCHAR, " +
                            "gene_refgene VARCHAR, gene_detail_refgene VARCHAR, exonic_function VARCHAR, " +
                            "aa_change_refgene VARCHAR, location VARCHAR)");
            statement.execute(
                    "CREATE TABLE tcga_maf (" +
                            "hugo_symbol VARCHAR, chromosome VARCHAR, start_position VARCHAR, end_position VARCHAR, " +
                            "reference_allele VARCHAR, tumor_seq_allele2 VARCHAR, tumor_sample_barcode VARCHAR, " +
                            "variant_classification VARCHAR, variant_type VARCHAR, cancer_type VARCHAR, " +
                            "transcript VARCHAR, exon VARCHAR, aa_change VARCHAR, functional_region VARCHAR, " +
                            "exonic_function VARCHAR)");
            statement.execute(
                    "CREATE TABLE geo_maf (" +
                            "cancer_type VARCHAR, geo_accession VARCHAR, chromosome VARCHAR, start_position VARCHAR, end_position VARCHAR, " +
                            "reference_allele VARCHAR, tumor_seq_allele2 VARCHAR, tumor_sample_barcode VARCHAR, " +
                            "hugo_symbol VARCHAR, variant_classification VARCHAR, variant_type VARCHAR, " +
                            "functional_region VARCHAR, gene_detail_refgene VARCHAR, aa_change_refgene VARCHAR, " +
                            "sample_type VARCHAR)");
            statement.execute(
                    "CREATE TABLE aggregate_multianno (" +
                            "cancer_type VARCHAR, source VARCHAR, sample_id VARCHAR, filename VARCHAR, file_path VARCHAR, " +
                            "\"Chr\" VARCHAR, \"Start\" VARCHAR, \"End\" VARCHAR, \"Ref\" VARCHAR, \"Alt\" VARCHAR, " +
                            "\"Func.refGene\" VARCHAR, \"Gene.refGene\" VARCHAR, \"ExonicFunc.refGene\" VARCHAR, " +
                            "\"AAChange.refGene\" VARCHAR, \"Tumor_Sample_Barcode\" VARCHAR)");
            statement.execute("CREATE TABLE pan_cancer_clinical (Tumor_Sample_Barcode VARCHAR, CancerType VARCHAR)");
            statement.execute("CREATE TABLE pan_cancer_mutations (Hugo_Symbol VARCHAR, Tumor_Sample_Barcode VARCHAR, Variant_Classification VARCHAR)");
            statement.execute(
                    "CREATE TABLE sample_inventory (" +
                            "cancer_type VARCHAR, source VARCHAR, sample_id VARCHAR, variant_count BIGINT, " +
                            "has_annotated BOOLEAN, has_somatic BOOLEAN, " +
                            "anno_file_name VARCHAR, anno_file_path VARCHAR, " +
                            "vcf_file_name VARCHAR, vcf_file_path VARCHAR, " +
                            "avinput_file_name VARCHAR, avinput_file_path VARCHAR, " +
                            "updated_at TIMESTAMP)");
            statement.execute("CREATE TABLE sample_top_genes (cancer_type VARCHAR, source VARCHAR, sample_id VARCHAR, gene_name VARCHAR, gene_count BIGINT, rank_no INTEGER)");
            statement.execute(
                    "CREATE TABLE cohort_file_index (" +
                            "cancer_type VARCHAR, source VARCHAR, category VARCHAR, file_name VARCHAR, display_name VARCHAR, " +
                            "sample_id VARCHAR, file_path VARCHAR, size_bytes BIGINT)");
            statement.execute(
                    "CREATE TABLE statistics_asset_index (" +
                            "cancer_type VARCHAR, source VARCHAR, asset_type VARCHAR, category VARCHAR, title VARCHAR, " +
                            "file_name VARCHAR, file_path VARCHAR, size_bytes BIGINT, gene_name VARCHAR, " +
                            "chromosome VARCHAR, start_position VARCHAR, end_position VARCHAR)");

            // VIEW that unions private cfDNA + GEO for "all cfDNA" queries
            statement.execute("DROP VIEW IF EXISTS all_cfdna_maf");
            statement.execute(
                    "CREATE VIEW all_cfdna_maf AS " +
                            "SELECT cancer_type, chromosome, start_position, end_position, " +
                            "reference_allele, tumor_seq_allele2, tumor_sample_barcode, " +
                            "hugo_symbol, variant_classification, variant_type, " +
                            "transcript, exon, aa_change, functional_region, exonic_function, " +
                            "gene_refgene, gene_detail_refgene, aa_change_refgene, location, tx_change " +
                            "FROM cfdna_maf " +
                            "UNION ALL " +
                            "SELECT cancer_type, chromosome, start_position, end_position, " +
                            "reference_allele, tumor_seq_allele2, tumor_sample_barcode, " +
                            "hugo_symbol, variant_classification, variant_type, " +
                            "'' AS transcript, '' AS exon, aa_change_refgene AS aa_change, " +
                            "functional_region, '' AS exonic_function, " +
                            "'' AS gene_refgene, gene_detail_refgene, aa_change_refgene, '' AS location, '' AS tx_change " +
                            "FROM geo_maf");
        }
    }

    private long importCfDna(Connection connection, Path filePath) throws SQLException {
        String sql =
                "INSERT INTO cfdna_maf " +
                        "SELECT " +
                        "COALESCE(CAST(Cancer_Type AS VARCHAR), ''), " +
                        "COALESCE(CAST(Chromosome AS VARCHAR), ''), " +
                        "COALESCE(CAST(Start_Position AS VARCHAR), ''), " +
                        "COALESCE(CAST(End_Position AS VARCHAR), ''), " +
                        "COALESCE(CAST(Reference_Allele AS VARCHAR), ''), " +
                        "COALESCE(CAST(Tumor_Seq_Allele2 AS VARCHAR), ''), " +
                        "COALESCE(CAST(Tumor_Sample_Barcode AS VARCHAR), ''), " +
                        "COALESCE(CAST(Hugo_Symbol AS VARCHAR), ''), " +
                        "COALESCE(CAST(Variant_Classification AS VARCHAR), ''), " +
                        "COALESCE(CAST(tx AS VARCHAR), ''), " +
                        "COALESCE(CAST(exon AS VARCHAR), ''), " +
                        "COALESCE(CAST(txChange AS VARCHAR), ''), " +
                        "COALESCE(CAST(aaChange AS VARCHAR), ''), " +
                        "COALESCE(CAST(Variant_Type AS VARCHAR), ''), " +
                        "COALESCE(CAST(\"Func.refGene\" AS VARCHAR), ''), " +
                        "COALESCE(CAST(\"Gene.refGene\" AS VARCHAR), ''), " +
                        "COALESCE(CAST(\"GeneDetail.refGene\" AS VARCHAR), ''), " +
                        "COALESCE(CAST(\"ExonicFunc.refGene\" AS VARCHAR), ''), " +
                        "COALESCE(CAST(\"AAChange.refGene\" AS VARCHAR), ''), " +
                        "COALESCE(CAST(Location AS VARCHAR), '') " +
                        "FROM read_csv_auto('" + duckPath(filePath) + "', delim='\\t', header=true, ignore_errors=true)";
        try (Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
        return tableCount(connection, "cfdna_maf");
    }

    private long importTcga(Connection connection, Path filePath) throws SQLException {
        String sql =
                "INSERT INTO tcga_maf " +
                        "SELECT " +
                        "COALESCE(CAST(Hugo_Symbol AS VARCHAR), ''), " +
                        "COALESCE(CAST(Chromosome AS VARCHAR), ''), " +
                        "COALESCE(CAST(Start_Position AS VARCHAR), ''), " +
                        "COALESCE(CAST(End_Position AS VARCHAR), ''), " +
                        "COALESCE(CAST(Reference_Allele AS VARCHAR), ''), " +
                        "COALESCE(CAST(Tumor_Seq_Allele2 AS VARCHAR), ''), " +
                        "COALESCE(CAST(Tumor_Sample_Barcode AS VARCHAR), ''), " +
                        "COALESCE(CAST(Variant_Classification AS VARCHAR), ''), " +
                        "COALESCE(CAST(Variant_Type AS VARCHAR), ''), " +
                        "'' AS cancer_type, '' AS transcript, '' AS exon, '' AS aa_change, '' AS functional_region, '' AS exonic_function " +
                        "FROM read_csv_auto('" + duckPath(filePath) + "', delim='\\t', header=true, ignore_errors=true)";
        try (Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
        return tableCount(connection, "tcga_maf");
    }

    private long importGeo(Connection connection) throws SQLException {
        long totalBefore = tableCount(connection, "geo_maf");
        for (String cancer : CANCERS) {
            Path geoDir = dataDir.resolve(cancer).resolve("geo");
            if (!Files.isDirectory(geoDir)) {
                continue;
            }
            try (Stream<Path> datasets = Files.list(geoDir)) {
                List<Path> dseDirs = datasets.filter(Files::isDirectory)
                        .filter(p -> p.getFileName().toString().startsWith("GSE"))
                        .sorted()
                        .collect(java.util.stream.Collectors.toList());
                for (Path dseDir : dseDirs) {
                    String accession = dseDir.getFileName().toString();
                    try (Stream<Path> files = Files.list(dseDir)) {
                        List<Path> annoFiles = files.filter(Files::isRegularFile)
                                .filter(p -> p.getFileName().toString().endsWith("_anno.txt"))
                                .sorted()
                                .collect(java.util.stream.Collectors.toList());
                        for (Path annoFile : annoFiles) {
                            importGeoAnnoFile(connection, cancer, accession, annoFile);
                            log.info("[QUERY-IMPORT] imported GEO file cancer={}, accession={}, file={}",
                                    cancer, accession, annoFile.getFileName());
                        }
                    }
                }
            } catch (IOException e) {
                log.warn("[QUERY-IMPORT] failed to scan GEO directory for {}: {}", cancer, e.getMessage());
            }
        }
        long total = tableCount(connection, "geo_maf");
        log.info("[QUERY-IMPORT] geo_maf total rows: {}", total);
        return total - totalBefore;
    }

    private void importGeoAnnoFile(Connection connection, String cancer, String accession, Path filePath) throws SQLException {
        String sql =
                "INSERT INTO geo_maf " +
                        "SELECT " +
                        "'" + cancer.replace("'", "''") + "', " +
                        "'" + accession.replace("'", "''") + "', " +
                        "COALESCE(CAST(Chromosome AS VARCHAR), ''), " +
                        "COALESCE(CAST(Start_Position AS VARCHAR), ''), " +
                        "COALESCE(CAST(End_Position AS VARCHAR), ''), " +
                        "COALESCE(CAST(Reference_Allele AS VARCHAR), ''), " +
                        "COALESCE(CAST(Tumor_Seq_Allele2 AS VARCHAR), ''), " +
                        "COALESCE(CAST(Tumor_Sample_Barcode AS VARCHAR), ''), " +
                        "COALESCE(CAST(Hugo_Symbol AS VARCHAR), ''), " +
                        "COALESCE(CAST(Variant_Classification AS VARCHAR), ''), " +
                        "COALESCE(CAST(Variant_Type AS VARCHAR), ''), " +
                        "COALESCE(CAST(Variant_Region AS VARCHAR), ''), " +
                        "COALESCE(CAST(\"GeneDetail.refGene\" AS VARCHAR), ''), " +
                        "COALESCE(CAST(\"AAChange.refGene\" AS VARCHAR), ''), " +
                        "COALESCE(CAST(Sample_Type AS VARCHAR), '') " +
                        "FROM read_csv_auto('" + duckPath(filePath) + "', delim='\\t', header=true, all_varchar=true, ignore_errors=true)";
        try (Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private long importAggregateFiles(Connection connection, List<AggregateFile> aggregateFiles) throws SQLException {
        try (Statement pragma = connection.createStatement()) {
            pragma.execute("PRAGMA threads=8");
        }

        String sql =
                "INSERT INTO aggregate_multianno " +
                        "SELECT ?, '', COALESCE(CAST(\"Tumor_Sample_Barcode\" AS VARCHAR), ''), ?, ?, " +
                        "COALESCE(CAST(Chr AS VARCHAR), ''), " +
                        "COALESCE(CAST(Start AS VARCHAR), ''), " +
                        "COALESCE(CAST(\"End\" AS VARCHAR), ''), " +
                        "COALESCE(CAST(Ref AS VARCHAR), ''), " +
                        "COALESCE(CAST(Alt AS VARCHAR), ''), " +
                        "COALESCE(CAST(\"Func.refGene\" AS VARCHAR), ''), " +
                        "COALESCE(CAST(\"Gene.refGene\" AS VARCHAR), ''), " +
                        "COALESCE(CAST(\"ExonicFunc.refGene\" AS VARCHAR), ''), " +
                        "COALESCE(CAST(\"AAChange.refGene\" AS VARCHAR), ''), " +
                        "COALESCE(CAST(\"Tumor_Sample_Barcode\" AS VARCHAR), '') " +
                        "FROM read_csv_auto(?, delim='\\t', header=true, all_varchar=true, ignore_errors=true)";

        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            int idx = 0;
            for (AggregateFile aggregateFile : aggregateFiles) {
                idx++;
                log.info("[QUERY-IMPORT] aggregate {}/{}: cancer={}, file={}",
                        idx, aggregateFiles.size(), aggregateFile.cancer,
                        aggregateFile.path.toAbsolutePath());
                statement.setString(1, aggregateFile.cancer);
                statement.setString(2, aggregateFile.path.getFileName().toString());
                statement.setString(3, aggregateFile.path.toAbsolutePath().toString());
                statement.setString(4, aggregateFile.path.toAbsolutePath().toString());
                statement.executeUpdate();
            }
        }
        return tableCount(connection, "aggregate_multianno");
    }

    private long importPanCancerFile(Connection connection, Path filePath, String tableName) throws SQLException {
        if (!Files.isRegularFile(filePath)) {
            return 0;
        }

        String sql;
        if ("pan_cancer_clinical".equals(tableName)) {
            sql = "INSERT INTO pan_cancer_clinical " +
                    "SELECT COALESCE(CAST(Tumor_Sample_Barcode AS VARCHAR), ''), COALESCE(CAST(CancerType AS VARCHAR), '') " +
                    "FROM read_csv_auto('" + duckPath(filePath) + "', delim='\\t', header=true, ignore_errors=true)";
        } else {
            sql = "INSERT INTO pan_cancer_mutations " +
                    "SELECT COALESCE(CAST(Hugo_Symbol AS VARCHAR), ''), " +
                    "COALESCE(CAST(Tumor_Sample_Barcode AS VARCHAR), ''), " +
                    "COALESCE(CAST(Variant_Classification AS VARCHAR), '') " +
                    "FROM read_csv_auto('" + duckPath(filePath) + "', delim='\\t', header=true, ignore_errors=true)";
        }
        try (Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
        return tableCount(connection, tableName);
    }

    private void insertSampleInventory(Connection connection, Map<SampleKey, SampleRow> sampleRows) throws SQLException {
        String sql = "INSERT INTO sample_inventory (" +
                "cancer_type, source, sample_id, variant_count, has_annotated, has_somatic, " +
                "anno_file_name, anno_file_path, vcf_file_name, vcf_file_path, avinput_file_name, avinput_file_path, updated_at" +
                ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            List<SampleRow> rows = sampleRows.values().stream()
                    .sorted(Comparator.comparing((SampleRow row) -> row.cancerType)
                            .thenComparing(row -> row.source)
                            .thenComparing(row -> row.sampleId))
                    .collect(java.util.stream.Collectors.toList());
            int batchCount = 0;
            for (SampleRow row : rows) {
                statement.setString(1, row.cancerType);
                statement.setString(2, row.source);
                statement.setString(3, row.sampleId);
                statement.setLong(4, row.variantCount);
                statement.setBoolean(5, row.hasAnnotated);
                statement.setBoolean(6, row.hasSomatic);
                statement.setString(7, row.annoFileName);
                statement.setString(8, pathValue(row.annoFilePath));
                statement.setString(9, row.vcfFileName);
                statement.setString(10, pathValue(row.vcfFilePath));
                statement.setString(11, row.avinputFileName);
                statement.setString(12, pathValue(row.avinputFilePath));
                statement.setTimestamp(13, Timestamp.from(Instant.now()));
                statement.addBatch();
                batchCount = flushBatchIfNeeded(connection, statement, batchCount + 1);
            }
            flushRemainingBatch(connection, statement, batchCount);
        }
    }

    private void insertSampleTopGenes(Connection connection, List<SampleTopGeneRow> rows) throws SQLException {
        String sql = "INSERT INTO sample_top_genes (cancer_type, source, sample_id, gene_name, gene_count, rank_no) VALUES (?, ?, ?, ?, ?, ?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            int batchCount = 0;
            for (SampleTopGeneRow row : rows) {
                statement.setString(1, row.cancerType);
                statement.setString(2, row.source);
                statement.setString(3, row.sampleId);
                statement.setString(4, row.geneName);
                statement.setLong(5, row.geneCount);
                statement.setInt(6, row.rankNo);
                statement.addBatch();
                batchCount = flushBatchIfNeeded(connection, statement, batchCount + 1);
            }
            flushRemainingBatch(connection, statement, batchCount);
        }
    }

    private void enrichTcgaSamples(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(
                    "UPDATE sample_inventory s " +
                            "SET variant_count = counts.variant_count " +
                            "FROM (" +
                            "  SELECT si.cancer_type, si.sample_id, COUNT(*) AS variant_count " +
                            "  FROM sample_inventory si " +
                            "  JOIN tcga_maf t ON t.tumor_sample_barcode = si.sample_id " +
                            "  WHERE si.source = 'tcga' " +
                            "  GROUP BY si.cancer_type, si.sample_id" +
                            ") counts " +
                            "WHERE s.source = 'tcga' AND s.cancer_type = counts.cancer_type AND s.sample_id = counts.sample_id");

            statement.execute(
                    "INSERT INTO sample_top_genes " +
                            "SELECT cancer_type, source, sample_id, gene_name, gene_count, rank_no " +
                            "FROM (" +
                            "  SELECT si.cancer_type AS cancer_type, si.source AS source, si.sample_id AS sample_id, " +
                            "         t.hugo_symbol AS gene_name, COUNT(*) AS gene_count, " +
                            "         ROW_NUMBER() OVER (PARTITION BY si.cancer_type, si.sample_id ORDER BY COUNT(*) DESC, t.hugo_symbol ASC) AS rank_no " +
                            "  FROM sample_inventory si " +
                            "  JOIN tcga_maf t ON t.tumor_sample_barcode = si.sample_id " +
                            "  WHERE si.source = 'tcga' AND COALESCE(t.hugo_symbol, '') <> '' " +
                            "  GROUP BY si.cancer_type, si.source, si.sample_id, t.hugo_symbol" +
                            ") ranked WHERE rank_no <= 10");
        }
    }

    private void insertCohortFileIndex(Connection connection, List<CohortFileRow> rows) throws SQLException {
        String sql = "INSERT INTO cohort_file_index (cancer_type, source, category, file_name, display_name, sample_id, file_path, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            int batchCount = 0;
            for (CohortFileRow row : rows) {
                statement.setString(1, row.cancerType);
                statement.setString(2, row.source);
                statement.setString(3, row.category);
                statement.setString(4, row.fileName);
                statement.setString(5, row.displayName);
                statement.setString(6, row.sampleId);
                statement.setString(7, row.filePath.toAbsolutePath().toString());
                statement.setLong(8, row.sizeBytes);
                statement.addBatch();
                batchCount = flushBatchIfNeeded(connection, statement, batchCount + 1);
            }
            flushRemainingBatch(connection, statement, batchCount);
        }
    }

    private void insertStatisticsAssetIndex(Connection connection, List<AssetRow> rows) throws SQLException {
        String sql = "INSERT INTO statistics_asset_index (" +
                "cancer_type, source, asset_type, category, title, file_name, file_path, size_bytes, gene_name, chromosome, start_position, end_position" +
                ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            int batchCount = 0;
            for (AssetRow row : rows) {
                statement.setString(1, row.cancerType);
                statement.setString(2, row.source);
                statement.setString(3, row.assetType);
                statement.setString(4, row.category);
                statement.setString(5, row.title);
                statement.setString(6, row.fileName);
                statement.setString(7, row.filePath.toAbsolutePath().toString());
                statement.setLong(8, row.sizeBytes);
                statement.setString(9, row.geneName);
                statement.setString(10, row.chromosome);
                statement.setString(11, row.startPosition);
                statement.setString(12, row.endPosition);
                statement.addBatch();
                batchCount = flushBatchIfNeeded(connection, statement, batchCount + 1);
            }
            flushRemainingBatch(connection, statement, batchCount);
        }
    }

    private int flushBatchIfNeeded(Connection connection, PreparedStatement statement, int batchCount) throws SQLException {
        if (batchCount < JDBC_BATCH_SIZE) {
            return batchCount;
        }
        statement.executeBatch();
        statement.clearBatch();
        connection.commit();
        return 0;
    }

    private void flushRemainingBatch(Connection connection, PreparedStatement statement, int batchCount) throws SQLException {
        if (batchCount <= 0) {
            return;
        }
        statement.executeBatch();
        statement.clearBatch();
        connection.commit();
    }

    private void createIndexes(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            for (String sql : List.of(
                    "CREATE INDEX IF NOT EXISTS idx_cfdna_maf_gene ON cfdna_maf(hugo_symbol)",
                    "CREATE INDEX IF NOT EXISTS idx_cfdna_maf_sample ON cfdna_maf(tumor_sample_barcode)",
                    "CREATE INDEX IF NOT EXISTS idx_cfdna_maf_cancer ON cfdna_maf(cancer_type)",
                    "CREATE INDEX IF NOT EXISTS idx_tcga_maf_gene ON tcga_maf(hugo_symbol)",
                    "CREATE INDEX IF NOT EXISTS idx_tcga_maf_sample ON tcga_maf(tumor_sample_barcode)",
                    "CREATE INDEX IF NOT EXISTS idx_geo_maf_gene ON geo_maf(hugo_symbol)",
                    "CREATE INDEX IF NOT EXISTS idx_geo_maf_sample ON geo_maf(tumor_sample_barcode)",
                    "CREATE INDEX IF NOT EXISTS idx_geo_maf_cancer ON geo_maf(cancer_type)",
                    "CREATE INDEX IF NOT EXISTS idx_aggregate_cancer ON aggregate_multianno(cancer_type)",
                    "CREATE INDEX IF NOT EXISTS idx_aggregate_sample ON aggregate_multianno(\"Tumor_Sample_Barcode\")",
                    "CREATE INDEX IF NOT EXISTS idx_sample_inventory_lookup ON sample_inventory(cancer_type, source, sample_id)",
                    "CREATE INDEX IF NOT EXISTS idx_sample_top_genes_lookup ON sample_top_genes(cancer_type, source, sample_id)",
                    "CREATE INDEX IF NOT EXISTS idx_cohort_file_lookup ON cohort_file_index(cancer_type, source, category, file_name)",
                    "CREATE INDEX IF NOT EXISTS idx_statistics_asset_lookup ON statistics_asset_index(cancer_type, source, asset_type, file_name)"
            )) {
                statement.execute(sql);
            }
            for (String table : List.of(
                    "cfdna_maf", "tcga_maf", "geo_maf", "aggregate_multianno",
                    "pan_cancer_clinical", "pan_cancer_mutations",
                    "sample_inventory", "sample_top_genes",
                    "cohort_file_index", "statistics_asset_index")) {
                statement.execute("ANALYZE " + table);
            }
        }
    }

    private Path requireFile(Path path, String label) {
        if (!Files.isRegularFile(path)) {
            throw new IllegalStateException(label + " not found: " + path);
        }
        return path;
    }

    private List<String> readTcgaSampleBarcodes(String cancer) {
        String tcgaCode;
        switch (cancer) {
            case "Breast":
                tcgaCode = "BRCA";
                break;
            case "Colorectal":
                tcgaCode = "COAD";
                break;
            case "Liver":
                tcgaCode = "LIHC";
                break;
            case "Lung":
                tcgaCode = "LUAD";
                break;
            case "Pancreatic":
                tcgaCode = "PAAD";
                break;
            case "Bladder":
                tcgaCode = "BLCA";
                break;
            case "Cervical":
                tcgaCode = "CESC";
                break;
            case "Endometrial":
                tcgaCode = "UCEC";
                break;
            case "Esophageal":
                tcgaCode = "ESCA";
                break;
            case "Gastric":
                tcgaCode = "STAD";
                break;
            case "HeadAndNeck":
                tcgaCode = "HNSC";
                break;
            case "Kidney":
                tcgaCode = "KIRC";
                break;
            case "Ovarian":
                tcgaCode = "OV";
                break;
            case "Thyroid":
                tcgaCode = "THCA";
                break;
            default:
                tcgaCode = null;
        }
        if (tcgaCode == null) {
            return List.of();
        }

        Path matrixFile = dataDir.resolve(cancer)
                .resolve("stats")
                .resolve("oncoplot")
                .resolve("oncoplot_matrix_TCGA_" + tcgaCode + ".txt");
        if (!Files.isRegularFile(matrixFile)) {
            return List.of();
        }

        List<String> barcodes = new ArrayList<>();
        try (BufferedReader reader = Files.newBufferedReader(matrixFile, StandardCharsets.UTF_8)) {
            reader.readLine();
            String line;
            while ((line = reader.readLine()) != null) {
                int tab = line.indexOf('\t');
                String barcode = tab > 0 ? line.substring(0, tab).trim() : line.trim();
                if (!barcode.isBlank()) {
                    barcodes.add(barcode);
                }
            }
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to read TCGA matrix " + matrixFile, exception);
        }
        return barcodes;
    }

    private Map<String, Long> readTopGenes(Path multiannoPath) {
        Map<String, Long> counts = new HashMap<>();
        try (Reader reader = newBomAwareReader(multiannoPath);
             CSVParser parser = CSVFormat.TDF.builder().setHeader().setSkipHeaderRecord(true).build().parse(reader)) {
            for (CSVRecord record : parser) {
                String raw = csvValue(record, "Gene.refGene");
                if (raw.isBlank()) {
                    continue;
                }
                for (String gene : raw.split(";")) {
                    String normalized = gene == null ? "" : gene.trim();
                    if (normalized.isEmpty() || ".".equals(normalized)) {
                        continue;
                    }
                    counts.merge(normalized, 1L, Long::sum);
                }
            }
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to read top genes from " + multiannoPath, exception);
        }

        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
                .limit(10)
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        Map.Entry::getValue,
                        (left, right) -> left,
                        LinkedHashMap::new));
    }

    private long countDataRows(Path path) {
        try (BufferedReader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
            long lines = reader.lines().count();
            return Math.max(0L, lines - 1L);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to count rows in " + path, exception);
        }
    }

    private void validateAggregateColumns(Path filePath) {
        try (BufferedReader reader = Files.newBufferedReader(filePath, StandardCharsets.UTF_8)) {
            String header = reader.readLine();
            if (header == null || header.isBlank()) {
                throw new IllegalStateException("Aggregate file has no header row: " + filePath);
            }
            List<String> columns = Arrays.asList(header.split("\t", -1));
            if (!columns.containsAll(REQUIRED_AGGREGATE_COLUMNS)) {
                throw new IllegalStateException("Aggregate file missing required columns " + REQUIRED_AGGREGATE_COLUMNS + ": " + filePath);
            }
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to validate aggregate file " + filePath, exception);
        }
    }

    private Reader newBomAwareReader(Path path) throws IOException {
        InputStream inputStream = Files.newInputStream(path);
        PushbackInputStream pushback = new PushbackInputStream(inputStream, 3);
        byte[] bom = new byte[3];
        int read = pushback.read(bom, 0, 3);
        if (read == 3) {
            boolean hasUtf8Bom = bom[0] == (byte) 0xEF && bom[1] == (byte) 0xBB && bom[2] == (byte) 0xBF;
            if (!hasUtf8Bom) {
                pushback.unread(bom, 0, 3);
            }
        } else if (read > 0) {
            pushback.unread(bom, 0, read);
        }
        return new BufferedReader(new InputStreamReader(pushback, StandardCharsets.UTF_8));
    }

    private String csvValue(CSVRecord record, String header) {
        if (!record.isMapped(header)) {
            return "";
        }
        String value = record.get(header);
        return value == null ? "" : value.trim();
    }

    private long tableCount(Connection connection, String tableName) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery("SELECT COUNT(*) FROM " + tableName)) {
            resultSet.next();
            return resultSet.getLong(1);
        }
    }

    private String pathValue(Path path) {
        return path == null ? null : path.toAbsolutePath().toString();
    }

    private String duckPath(Path path) {
        return path.toAbsolutePath().toString().replace("\\", "/").replace("'", "''");
    }

    private long safeFileSize(Path path) {
        try {
            return Files.size(path);
        } catch (IOException exception) {
            return 0L;
        }
    }

    private String humanizeFileName(String fileName) {
        return fileName.replace('_', ' ').replace(".pdf", "").trim();
    }

    private String toRelativeCategory(String cancer, Path directory) {
        Path cancerDir = dataDir.resolve(cancer).toAbsolutePath();
        Path absoluteDirectory = directory.toAbsolutePath();
        if (!absoluteDirectory.startsWith(cancerDir)) {
            return directory.getFileName().toString();
        }
        return cancerDir.relativize(absoluteDirectory).toString().replace("\\", "/");
    }

    private boolean isLollipopCategory(String category) {
        String normalized = category == null ? "" : category.toLowerCase(Locale.ROOT).replace("\\", "/");
        return normalized.endsWith("/lollipop") || "lollipop".equals(normalized);
    }

    private String extractSampleId(String fileName, String category) {
        if ("multianno".equals(category)) {
            int idx = fileName.indexOf(".hg38_multianno");
            if (idx > 0) {
                return fileName.substring(0, idx);
            }
            idx = fileName.indexOf("_multianno");
            if (idx > 0) {
                return fileName.substring(0, idx);
            }
        } else if ("vcf".equals(category)) {
            int idx = fileName.indexOf(".filtered");
            if (idx > 0) {
                return fileName.substring(0, idx);
            }
            idx = fileName.indexOf(".vcf");
            if (idx > 0) {
                return fileName.substring(0, idx);
            }
        } else if ("avinput".equals(category)) {
            int idx = fileName.indexOf(".avinput");
            if (idx > 0) {
                return fileName.substring(0, idx);
            }
        }
        int dot = fileName.indexOf('.');
        return dot > 0 ? fileName.substring(0, dot) : fileName;
    }

    private static final class ImportPlan {
        private final List<AggregateFile> aggregateFiles = new ArrayList<>();
        private final LinkedHashMap<SampleKey, SampleRow> sampleRows = new LinkedHashMap<>();
        private final List<SampleTopGeneRow> sampleTopGeneRows = new ArrayList<>();
        private final List<CohortFileRow> cohortFileRows = new ArrayList<>();
        private final List<AssetRow> assetRows = new ArrayList<>();
    }

    private static final class AggregateFile {
        private final String cancer;
        private final Path path;

        private AggregateFile(String cancer, Path path) {
            this.cancer = cancer;
            this.path = path;
        }
    }

    private static final class SampleKey {
        private final String cancerType;
        private final String source;
        private final String sampleId;

        private SampleKey(String cancerType, String source, String sampleId) {
            this.cancerType = cancerType;
            this.source = source;
            this.sampleId = sampleId;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof SampleKey)) {
                return false;
            }
            SampleKey that = (SampleKey) other;
            return Objects.equals(cancerType, that.cancerType)
                    && Objects.equals(source, that.source)
                    && Objects.equals(sampleId, that.sampleId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(cancerType, source, sampleId);
        }
    }

    private static final class SampleRow {
        private final String cancerType;
        private final String source;
        private final String sampleId;
        private long variantCount;
        private boolean hasAnnotated;
        private boolean hasSomatic;
        private String annoFileName;
        private Path annoFilePath;
        private String vcfFileName;
        private Path vcfFilePath;
        private String avinputFileName;
        private Path avinputFilePath;
        private final LinkedHashMap<String, Long> topGenes = new LinkedHashMap<>();

        private SampleRow(String cancerType, String source, String sampleId) {
            this.cancerType = cancerType;
            this.source = source;
            this.sampleId = sampleId;
        }
    }

    private static final class SampleTopGeneRow {
        private final String cancerType;
        private final String source;
        private final String sampleId;
        private final String geneName;
        private final long geneCount;
        private final int rankNo;

        private SampleTopGeneRow(String cancerType, String source, String sampleId, String geneName, long geneCount, int rankNo) {
            this.cancerType = cancerType;
            this.source = source;
            this.sampleId = sampleId;
            this.geneName = geneName;
            this.geneCount = geneCount;
            this.rankNo = rankNo;
        }
    }

    private static final class CohortFileRow {
        private final String cancerType;
        private final String source;
        private final String category;
        private final String fileName;
        private final String displayName;
        private final String sampleId;
        private final Path filePath;
        private final long sizeBytes;

        private CohortFileRow(String cancerType, String source, String category, String fileName, String displayName,
                              String sampleId, Path filePath, long sizeBytes) {
            this.cancerType = cancerType;
            this.source = source;
            this.category = category;
            this.fileName = fileName;
            this.displayName = displayName;
            this.sampleId = sampleId;
            this.filePath = filePath;
            this.sizeBytes = sizeBytes;
        }
    }

    private static final class AssetRow {
        private final String cancerType;
        private final String source;
        private final String assetType;
        private final String category;
        private final String title;
        private final String fileName;
        private final Path filePath;
        private final long sizeBytes;
        private final String geneName;
        private final String chromosome;
        private final String startPosition;
        private final String endPosition;

        private AssetRow(String cancerType, String source, String assetType, String category, String title,
                         String fileName, Path filePath, long sizeBytes, String geneName,
                         String chromosome, String startPosition, String endPosition) {
            this.cancerType = cancerType;
            this.source = source;
            this.assetType = assetType;
            this.category = category;
            this.title = title;
            this.fileName = fileName;
            this.filePath = filePath;
            this.sizeBytes = sizeBytes;
            this.geneName = geneName;
            this.chromosome = chromosome;
            this.startPosition = startPosition;
            this.endPosition = endPosition;
        }
    }
}
