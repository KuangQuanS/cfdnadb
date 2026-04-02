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
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;

@Service
public class MafDuckDbImportService {

    private static final Logger log = LoggerFactory.getLogger(MafDuckDbImportService.class);
    private static final String CFDNA_TSV = "cfDNA_MAF_Mutations.tsv";
    private static final String TCGA_TSV = "TCGA_maf_mutation.tsv";
    private static final String MAF_DB_DEFAULT_FILE = "maf.duckdb";
    private static final int BATCH_SIZE = 5_000;

    private final Path dataDir;
    private final String mafDbFileName;

    public MafDuckDbImportService(@Value("${app.data-dir:/400T/cfdnadb}") String dataDir,
                                  @Value("${app.maf-db-file:maf.duckdb}") String mafDbFileName) {
        this.dataDir = Path.of(dataDir);
        this.mafDbFileName = mafDbFileName == null || mafDbFileName.isBlank() ? MAF_DB_DEFAULT_FILE : mafDbFileName;
    }

    public Path rebuildDatabase() {
        Path dbPath = dataDir.resolve(mafDbFileName).toAbsolutePath();
        Path cfDnaPath = dataDir.resolve(CFDNA_TSV).toAbsolutePath();
        Path tcgaPath = dataDir.resolve(TCGA_TSV).toAbsolutePath();

        if (!Files.isRegularFile(cfDnaPath)) {
            throw new IllegalStateException("cfDNA MAF TSV not found: " + cfDnaPath);
        }
        if (!Files.isRegularFile(tcgaPath)) {
            throw new IllegalStateException("TCGA MAF TSV not found: " + tcgaPath);
        }

        try {
            Files.createDirectories(dataDir);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to create data directory " + dataDir, e);
        }

        log.info("[MAF-IMPORT] rebuilding database at {}", dbPath);
        try (Connection connection = DriverManager.getConnection("jdbc:duckdb:" + dbPath)) {
            connection.setAutoCommit(false);
            recreateTables(connection);
            long cfDnaRows = importCfDna(connection, cfDnaPath);
            long tcgaRows = importTcga(connection, tcgaPath);
            createIndexes(connection);
            connection.commit();
            log.info("[MAF-IMPORT] finished: cfDNA rows={}, TCGA rows={}, db={}", cfDnaRows, tcgaRows, dbPath);
            return dbPath;
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to rebuild DuckDB database at " + dbPath, e);
        }
    }

    private void recreateTables(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("DROP TABLE IF EXISTS cfdna_maf");
            statement.execute("DROP TABLE IF EXISTS tcga_maf");

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
        }
    }

    private long importCfDna(Connection connection, Path filePath) throws SQLException {
        String sql = "INSERT INTO cfdna_maf (" +
                "cancer_type, chromosome, start_position, end_position, reference_allele, tumor_seq_allele2, " +
                "tumor_sample_barcode, hugo_symbol, variant_classification, transcript, exon, tx_change, aa_change, " +
                "variant_type, functional_region, gene_refgene, gene_detail_refgene, exonic_function, aa_change_refgene, location" +
                ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        try (Reader reader = newBomAwareReader(filePath);
             CSVParser parser = CSVFormat.TDF.builder().setHeader().setSkipHeaderRecord(true).build().parse(reader);
             PreparedStatement statement = connection.prepareStatement(sql)) {
            long rowCount = 0;
            for (CSVRecord record : parser) {
                statement.setString(1, csvValue(record, "Cancer_Type"));
                statement.setString(2, csvValue(record, "Chromosome"));
                statement.setString(3, csvValue(record, "Start_Position"));
                statement.setString(4, csvValue(record, "End_Position"));
                statement.setString(5, csvValue(record, "Reference_Allele"));
                statement.setString(6, csvValue(record, "Tumor_Seq_Allele2"));
                statement.setString(7, csvValue(record, "Tumor_Sample_Barcode"));
                statement.setString(8, csvValue(record, "Hugo_Symbol"));
                statement.setString(9, csvValue(record, "Variant_Classification"));
                statement.setString(10, csvValue(record, "tx"));
                statement.setString(11, csvValue(record, "exon"));
                statement.setString(12, csvValue(record, "txChange"));
                statement.setString(13, csvValue(record, "aaChange"));
                statement.setString(14, csvValue(record, "Variant_Type"));
                statement.setString(15, csvValue(record, "Func.refGene"));
                statement.setString(16, csvValue(record, "Gene.refGene"));
                statement.setString(17, csvValue(record, "GeneDetail.refGene"));
                statement.setString(18, csvValue(record, "ExonicFunc.refGene"));
                statement.setString(19, csvValue(record, "AAChange.refGene"));
                statement.setString(20, csvValue(record, "Location"));
                statement.addBatch();

                rowCount++;
                if (rowCount % BATCH_SIZE == 0) {
                    statement.executeBatch();
                    connection.commit();
                    log.info("[MAF-IMPORT] cfDNA imported {} rows", rowCount);
                }
            }
            statement.executeBatch();
            connection.commit();
            return rowCount;
        } catch (IOException e) {
            throw new IllegalStateException("Failed to import cfDNA TSV " + filePath, e);
        }
    }

    private long importTcga(Connection connection, Path filePath) throws SQLException {
        String sql = "INSERT INTO tcga_maf (" +
                "hugo_symbol, chromosome, start_position, end_position, reference_allele, tumor_seq_allele2, " +
                "tumor_sample_barcode, variant_classification, variant_type, cancer_type, transcript, exon, aa_change, functional_region, exonic_function" +
                ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', '', '', '', '')";

        try (Reader reader = newBomAwareReader(filePath);
             CSVParser parser = CSVFormat.TDF.builder().setHeader().setSkipHeaderRecord(true).build().parse(reader);
             PreparedStatement statement = connection.prepareStatement(sql)) {
            long rowCount = 0;
            for (CSVRecord record : parser) {
                statement.setString(1, csvValue(record, "Hugo_Symbol"));
                statement.setString(2, csvValue(record, "Chromosome"));
                statement.setString(3, csvValue(record, "Start_Position"));
                statement.setString(4, csvValue(record, "End_Position"));
                statement.setString(5, csvValue(record, "Reference_Allele"));
                statement.setString(6, csvValue(record, "Tumor_Seq_Allele2"));
                statement.setString(7, csvValue(record, "Tumor_Sample_Barcode"));
                statement.setString(8, csvValue(record, "Variant_Classification"));
                statement.setString(9, csvValue(record, "Variant_Type"));
                statement.addBatch();

                rowCount++;
                if (rowCount % BATCH_SIZE == 0) {
                    statement.executeBatch();
                    connection.commit();
                    log.info("[MAF-IMPORT] TCGA imported {} rows", rowCount);
                }
            }
            statement.executeBatch();
            connection.commit();
            return rowCount;
        } catch (IOException e) {
            throw new IllegalStateException("Failed to import TCGA TSV " + filePath, e);
        }
    }

    private void createIndexes(Connection connection) throws SQLException {
        List<String> statements = List.of(
                "CREATE INDEX IF NOT EXISTS idx_cfdna_maf_gene ON cfdna_maf(hugo_symbol)",
                "CREATE INDEX IF NOT EXISTS idx_cfdna_maf_sample ON cfdna_maf(tumor_sample_barcode)",
                "CREATE INDEX IF NOT EXISTS idx_cfdna_maf_cancer ON cfdna_maf(cancer_type)",
                "CREATE INDEX IF NOT EXISTS idx_cfdna_maf_chr ON cfdna_maf(chromosome)",
                "CREATE INDEX IF NOT EXISTS idx_tcga_maf_gene ON tcga_maf(hugo_symbol)",
                "CREATE INDEX IF NOT EXISTS idx_tcga_maf_sample ON tcga_maf(tumor_sample_barcode)",
                "CREATE INDEX IF NOT EXISTS idx_tcga_maf_chr ON tcga_maf(chromosome)"
        );

        try (Statement statement = connection.createStatement()) {
            for (String sql : statements) {
                statement.execute(sql);
            }
            statement.execute("ANALYZE cfdna_maf");
            statement.execute("ANALYZE tcga_maf");
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
}
