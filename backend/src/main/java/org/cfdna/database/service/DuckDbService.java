package org.cfdna.database.service;

import org.cfdna.database.dto.CancerAssetDto;
import org.cfdna.database.dto.GenePlotDto;
import org.cfdna.database.dto.CancerSummaryDto;
import org.cfdna.database.dto.CohortFileDto;
import org.cfdna.database.dto.DataFileDto;
import org.cfdna.database.dto.DatabaseStatsDto;
import org.cfdna.database.dto.GeneSummaryDto;
import org.cfdna.database.dto.GeneVariantDto;
import org.cfdna.database.dto.LabelCountDto;
import org.cfdna.database.dto.MafFilterOptionsDto;
import org.cfdna.database.dto.MafGeneSummaryDto;
import org.cfdna.database.dto.MafMutationDto;
import org.cfdna.database.dto.MafSummaryDto;
import org.cfdna.database.dto.OncoplottDto;
import org.cfdna.database.dto.PagedResponse;
import org.cfdna.database.dto.SampleBrowseItemDto;
import org.cfdna.database.dto.SampleDetailDto;
import org.cfdna.database.dto.SampleDownloadRequestDto;
import org.cfdna.database.dto.SampleFileDto;
import org.cfdna.database.dto.SampleSelectionDto;
import org.cfdna.database.dto.TopGeneDto;
import org.cfdna.database.dto.VafDistributionDto;
import org.cfdna.database.exception.ResourceNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriUtils;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class DuckDbService {

    private static final Logger log = LoggerFactory.getLogger(DuckDbService.class);
    private static final Path DEFAULT_DATA_DIR = Path.of("/400T/cfdnaweb");
    private static final List<String> CANCERS = List.of(
            "Breast", "Colorectal", "Liver", "Lung", "Pancreatic",
            "Bladder", "Cervical", "Endometrial", "Esophageal", "Gastric",
            "HeadAndNeck", "Kidney", "Ovarian", "Thyroid", "NGY");
    private static final List<String> REQUIRED_MULTIANNO_COLUMNS = List.of(
            "Chr",
            "Start",
            "End",
            "Ref",
            "Alt",
            "Func.refGene",
            "Gene.refGene",
            "Tumor_Sample_Barcode"
    );

    private final Path dataDir;
    private final String queryDbFileName;
    private final Path tcgaIgvFile;
    private final Path panCancerDir;
    private final Path vafDataDir;

    @Autowired
    public DuckDbService(@Value("${app.data-dir:/400T/cfdnaweb}") String dataDir,
                         @Value("${app.query-db-file:${app.maf-db-file:cfdnadb.duckdb}}") String queryDbFileName,
                         @Value("${app.tcga-igv-file:/400T/cfdnaweb/tcga_maf.txt}") String tcgaIgvFile,
                         @Value("${app.pan-cancer-dir:/400T/cfdnaweb/statistics/oncoplot/pan_cancer}") String panCancerDir,
                         @Value("${app.vaf-data-dir:/400T/cfdnadb/MAF_all/PDF/PAN_cancer/cfDNA_VAF}") String vafDataDir) {
        this(Path.of(dataDir), queryDbFileName, Path.of(tcgaIgvFile), Path.of(panCancerDir), Path.of(vafDataDir));
    }

    public DuckDbService(Path dataDir) {
        this(dataDir, "cfdnadb.duckdb", dataDir.resolve("tcga_maf.txt"), Path.of("/400T/cfdnaweb/statistics/oncoplot/pan_cancer"), Path.of("/400T/cfdnadb/MAF_all/PDF/PAN_cancer/cfDNA_VAF"));
    }

    public DuckDbService(Path dataDir, String queryDbFileName) {
        this(dataDir, queryDbFileName, dataDir.resolve("tcga_maf.txt"), Path.of("/400T/cfdnaweb/statistics/oncoplot/pan_cancer"), Path.of("/400T/cfdnadb/MAF_all/PDF/PAN_cancer/cfDNA_VAF"));
    }

    public DuckDbService(Path dataDir, String queryDbFileName, Path tcgaIgvFile, Path panCancerDir) {
        this(dataDir, queryDbFileName, tcgaIgvFile, panCancerDir, Path.of("/400T/cfdnadb/MAF_all/PDF/PAN_cancer/cfDNA_VAF"));
    }

    public DuckDbService(Path dataDir, String queryDbFileName, Path tcgaIgvFile, Path panCancerDir, Path vafDataDir) {
        this.dataDir = dataDir;
        this.queryDbFileName = queryDbFileName;
        this.tcgaIgvFile = tcgaIgvFile;
        this.panCancerDir = panCancerDir;
        this.vafDataDir = vafDataDir;
        ensureDuckDbDriverLoaded();
    }

    private void ensureDuckDbDriverLoaded() {
        try {
            Class.forName("org.duckdb.DuckDBDriver");
        } catch (ClassNotFoundException exception) {
            throw new IllegalStateException("DuckDB JDBC driver is not available on the application classpath.", exception);
        }
    }

    public List<CancerSummaryDto> getCancerSummary() {
        return CANCERS.stream()
                .map(this::buildCancerSummary)
                .toList();
    }

    public List<TopGeneDto> getTopGenes(String cancer, int limit) {
        String readExpr = resolveMultiCancerReadExpr(validateCancer(cancer));
        if (readExpr == null) {
            return List.of();
        }

        String sql = "SELECT TRIM(gene_name) AS gene, COUNT(*) AS occurrence_count " +
                "FROM (" +
                "  SELECT UNNEST(STRING_SPLIT(COALESCE(\"Gene.refGene\", ''), ';')) AS gene_name " +
                "  FROM %s" +
                ") split_genes " +
                "WHERE TRIM(gene_name) <> '' AND TRIM(gene_name) <> '.' " +
                "GROUP BY gene " +
                "ORDER BY occurrence_count DESC, gene ASC " +
                "LIMIT %d";

        List<TopGeneDto> results = new ArrayList<>();
        try (Connection connection = openMafConnection();
             Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(sql.formatted(readExpr, limit))) {
            while (resultSet.next()) {
                results.add(new TopGeneDto(resultSet.getString("gene"), resultSet.getLong("occurrence_count")));
            }
            return results;
        } catch (SQLException exception) {
            log.warn("Failed to query top genes for {}", cancer, exception);
            return List.of();
        }
    }

    public PagedResponse<GeneVariantDto> getVariantsByGene(String cancer, String gene, int page, int pageSize) {
        String readExpr = resolveMultiCancerReadExpr(validateCancer(cancer));
        if (readExpr == null) {
            return new PagedResponse<>(List.of(), page, pageSize, 0, 0, true, true);
        }

        String normalizedGene = gene.trim().toLowerCase(Locale.ROOT);
        String countSql = "SELECT COUNT(*) AS total_rows " +
                "FROM %s " +
                "WHERE POSITION(? IN LOWER(COALESCE(\"Gene.refGene\", ''))) > 0";

        String dataSql = "SELECT " +
                "  COALESCE(CAST(Chr AS VARCHAR), '') AS chr, " +
                "  COALESCE(CAST(Start AS VARCHAR), '') AS start_pos, " +
                "  COALESCE(CAST(\"End\" AS VARCHAR), '') AS end_pos, " +
                "  COALESCE(CAST(Ref AS VARCHAR), '') AS ref_allele, " +
                "  COALESCE(CAST(Alt AS VARCHAR), '') AS alt_allele, " +
                "  COALESCE(CAST(\"Func.refGene\" AS VARCHAR), '') AS functional_class, " +
                "  COALESCE(CAST(\"ExonicFunc.refGene\" AS VARCHAR), '') AS exonic_func, " +
                "  COALESCE(CAST(\"Gene.refGene\" AS VARCHAR), '') AS gene_symbol, " +
                "  COALESCE(CAST(\"AAChange.refGene\" AS VARCHAR), '') AS aa_change, " +
                "  COALESCE(CAST(Tumor_Sample_Barcode AS VARCHAR), '') AS sample_barcode " +
                "FROM %s " +
                "WHERE POSITION(? IN LOWER(COALESCE(\"Gene.refGene\", ''))) > 0 " +
                "ORDER BY start_pos ASC, sample_barcode ASC " +
                "LIMIT ? OFFSET ?";

        long totalRows;
        try (Connection connection = openMafConnection();
             PreparedStatement countStatement = connection.prepareStatement(countSql.formatted(readExpr))) {
            countStatement.setString(1, normalizedGene);
            try (ResultSet resultSet = countStatement.executeQuery()) {
                resultSet.next();
                totalRows = resultSet.getLong("total_rows");
            }

            if (totalRows == 0) {
                return new PagedResponse<>(List.of(), page, pageSize, 0, 0, true, true);
            }

            List<GeneVariantDto> content = new ArrayList<>();
            try (PreparedStatement dataStatement = connection.prepareStatement(dataSql.formatted(readExpr))) {
                dataStatement.setString(1, normalizedGene);
                dataStatement.setInt(2, pageSize);
                dataStatement.setInt(3, Math.max(page - 1, 0) * pageSize);

                try (ResultSet resultSet = dataStatement.executeQuery()) {
                    while (resultSet.next()) {
                        content.add(new GeneVariantDto(
                                resultSet.getString("chr"),
                                resultSet.getString("start_pos"),
                                resultSet.getString("end_pos"),
                                resultSet.getString("ref_allele"),
                                resultSet.getString("alt_allele"),
                                resultSet.getString("functional_class"),
                                resultSet.getString("exonic_func"),
                                resultSet.getString("gene_symbol"),
                                resultSet.getString("aa_change"),
                                resultSet.getString("sample_barcode")
                        ));
                    }
                }
            }

            int totalPages = (int) Math.ceil(totalRows / (double) pageSize);
            boolean first = page <= 1;
            boolean last = totalPages == 0 || page >= totalPages;
            return new PagedResponse<>(content, page, pageSize, totalRows, totalPages, first, last);
        } catch (SQLException exception) {
            log.warn("Failed to query variants for {} / {}", cancer, gene, exception);
            return new PagedResponse<>(List.of(), page, pageSize, 0, 0, true, true);
        }
    }

    public PagedResponse<GeneVariantDto> getVariants(String cancer, String gene, String funcClass,
                                                      String exonicFunc, String chr, String sample,
                                                      Long startMin, Long startMax,
                                                      int page, int pageSize) {
        String readExpr = resolveMultiCancerReadExpr(cancer);
        if (readExpr == null) {
            return new PagedResponse<>(List.of(), page, pageSize, 0, 0, true, true);
        }

        boolean hasGene = gene != null && !gene.isBlank();
        boolean hasFunc = funcClass != null && !funcClass.isBlank();
        boolean hasExonic = exonicFunc != null && !exonicFunc.isBlank();
        boolean hasChr = chr != null && !chr.isBlank();
        boolean hasSample = sample != null && !sample.isBlank();
        boolean hasStartMin = startMin != null;
        boolean hasStartMax = startMax != null;
        String normalizedGene = hasGene ? gene.trim().toLowerCase(Locale.ROOT) : "";

        String whereClause = buildVariantWhereClause(hasGene, hasFunc, hasExonic, hasChr, hasSample, hasStartMin, hasStartMax);

        String countSql = "SELECT COUNT(*) AS total_rows FROM " + readExpr + " " + whereClause;
        String dataSql = "SELECT " +
                "  COALESCE(CAST(Chr AS VARCHAR), '') AS chr, " +
                "  COALESCE(CAST(Start AS VARCHAR), '') AS start_pos, " +
                "  COALESCE(CAST(\"End\" AS VARCHAR), '') AS end_pos, " +
                "  COALESCE(CAST(Ref AS VARCHAR), '') AS ref_allele, " +
                "  COALESCE(CAST(Alt AS VARCHAR), '') AS alt_allele, " +
                "  COALESCE(CAST(\"Func.refGene\" AS VARCHAR), '') AS functional_class, " +
                "  COALESCE(CAST(\"ExonicFunc.refGene\" AS VARCHAR), '') AS exonic_func, " +
                "  COALESCE(CAST(\"Gene.refGene\" AS VARCHAR), '') AS gene_symbol, " +
                "  COALESCE(CAST(\"AAChange.refGene\" AS VARCHAR), '') AS aa_change, " +
                "  COALESCE(CAST(Tumor_Sample_Barcode AS VARCHAR), '') AS sample_barcode " +
                "FROM " + readExpr + " " +
                whereClause +
                "ORDER BY chr ASC, start_pos ASC LIMIT ? OFFSET ?";

        long totalRows;
        try (Connection connection = openMafConnection();
             PreparedStatement countStmt = connection.prepareStatement(countSql)) {
            int idx = 1;
            idx = bindBrowseParams(countStmt, idx, hasGene, normalizedGene, hasFunc, funcClass,
                    hasExonic, exonicFunc, hasChr, chr, hasSample, sample, hasStartMin, startMin, hasStartMax, startMax);
            try (ResultSet rs = countStmt.executeQuery()) {
                rs.next();
                totalRows = rs.getLong("total_rows");
            }
            if (totalRows == 0) return new PagedResponse<>(List.of(), page, pageSize, 0, 0, true, true);

            List<GeneVariantDto> content = new ArrayList<>();
            try (PreparedStatement dataStmt = connection.prepareStatement(dataSql)) {
                int di = 1;
                di = bindBrowseParams(dataStmt, di, hasGene, normalizedGene, hasFunc, funcClass,
                        hasExonic, exonicFunc, hasChr, chr, hasSample, sample, hasStartMin, startMin, hasStartMax, startMax);
                dataStmt.setInt(di++, pageSize);
                dataStmt.setInt(di, Math.max(page - 1, 0) * pageSize);
                try (ResultSet rs = dataStmt.executeQuery()) {
                    while (rs.next()) {
                        content.add(new GeneVariantDto(
                                rs.getString("chr"), rs.getString("start_pos"), rs.getString("end_pos"),
                                rs.getString("ref_allele"), rs.getString("alt_allele"),
                                rs.getString("functional_class"), rs.getString("exonic_func"),
                                rs.getString("gene_symbol"), rs.getString("aa_change"),
                                rs.getString("sample_barcode")));
                    }
                }
            }
            int totalPages = (int) Math.ceil(totalRows / (double) pageSize);
            boolean first = page <= 1;
            boolean last = totalPages == 0 || page >= totalPages;
            return new PagedResponse<>(content, page, pageSize, totalRows, totalPages, first, last);
        } catch (SQLException exception) {
            log.warn("Variant browse query failed for {}: {}", cancer, exception.getMessage());
            return new PagedResponse<>(List.of(), page, pageSize, 0, 0, true, true);
        }
    }

    public GeneSummaryDto getGeneSummary(String cancer, String gene) {
        String readExpr = resolveMultiCancerReadExpr(validateCancer(cancer));
        if (readExpr == null) {
            return new GeneSummaryDto(gene, cancer, 0, 0, List.of(), List.of(), List.of());
        }

        String normalizedGene = gene.trim().toLowerCase(Locale.ROOT);
        String geneFilter = "POSITION('%s' IN LOWER(COALESCE(\"Gene.refGene\", ''))) > 0".formatted(normalizedGene.replace("'", "''"));

        String statsSql = "SELECT COUNT(*) AS total_vars, COUNT(DISTINCT Tumor_Sample_Barcode) AS unique_samples " +
                "FROM %s WHERE %s";
        String funcSql = "SELECT COALESCE(\"Func.refGene\", '') AS label, COUNT(*) AS cnt " +
                "FROM %s WHERE %s " +
                "GROUP BY label ORDER BY cnt DESC";
        String exonicSql = "SELECT COALESCE(\"ExonicFunc.refGene\", '') AS label, COUNT(*) AS cnt " +
                "FROM %s WHERE %s " +
                "AND COALESCE(\"ExonicFunc.refGene\", '') <> '' AND COALESCE(\"ExonicFunc.refGene\", '') <> '.' " +
                "GROUP BY label ORDER BY cnt DESC";
        String chromSql = "SELECT COALESCE(CAST(Chr AS VARCHAR), '') AS label, COUNT(*) AS cnt " +
                "FROM %s WHERE %s " +
                "GROUP BY label ORDER BY cnt DESC";

        try (Connection connection = openMafConnection();
             Statement stmt = connection.createStatement()) {

            long totalVars = 0;
            long uniqueSamples = 0;
            try (ResultSet rs = stmt.executeQuery(statsSql.formatted(readExpr, geneFilter))) {
                if (rs.next()) {
                    totalVars = rs.getLong("total_vars");
                    uniqueSamples = rs.getLong("unique_samples");
                }
            }

            List<LabelCountDto> funcBreakdown = new ArrayList<>();
            try (ResultSet rs = stmt.executeQuery(funcSql.formatted(readExpr, geneFilter))) {
                while (rs.next()) funcBreakdown.add(new LabelCountDto(rs.getString("label"), rs.getLong("cnt")));
            }

            List<LabelCountDto> exonicBreakdown = new ArrayList<>();
            try (ResultSet rs = stmt.executeQuery(exonicSql.formatted(readExpr, geneFilter))) {
                while (rs.next()) exonicBreakdown.add(new LabelCountDto(rs.getString("label"), rs.getLong("cnt")));
            }

            List<LabelCountDto> chromBreakdown = new ArrayList<>();
            try (ResultSet rs = stmt.executeQuery(chromSql.formatted(readExpr, geneFilter))) {
                while (rs.next()) chromBreakdown.add(new LabelCountDto(rs.getString("label"), rs.getLong("cnt")));
            }

            return new GeneSummaryDto(gene, cancer, totalVars, uniqueSamples, funcBreakdown, exonicBreakdown, chromBreakdown);
        } catch (SQLException exception) {
            log.warn("Gene summary query failed for {} / {}: {}", cancer, gene, exception.getMessage());
            return new GeneSummaryDto(gene, cancer, 0, 0, List.of(), List.of(), List.of());
        }
    }

    private int bindBrowseParams(PreparedStatement stmt, int idx,
                                 boolean hasGene, String normalizedGene,
                                 boolean hasFunc, String funcClass,
                                 boolean hasExonic, String exonicFunc,
                                 boolean hasChr, String chr,
                                 boolean hasSample, String sample,
                                 boolean hasStartMin, Long startMin,
                                 boolean hasStartMax, Long startMax) throws SQLException {
        if (hasGene) stmt.setString(idx++, normalizedGene);
        if (hasFunc) stmt.setString(idx++, funcClass.trim());
        if (hasExonic) stmt.setString(idx++, exonicFunc.trim());
        if (hasChr) stmt.setString(idx++, chr.trim());
        if (hasSample) stmt.setString(idx++, sample.trim());
        if (hasStartMin) stmt.setLong(idx++, startMin);
        if (hasStartMax) stmt.setLong(idx++, startMax);
        return idx;
    }

    private String buildVariantWhereClause(boolean hasGene, boolean hasFunc, boolean hasExonic,
                                           boolean hasChr, boolean hasSample,
                                           boolean hasStartMin, boolean hasStartMax) {
        List<String> conditions = new ArrayList<>();
        if (hasGene) conditions.add("POSITION(? IN LOWER(COALESCE(\"Gene.refGene\", ''))) > 0");
        if (hasFunc) conditions.add("TRIM(COALESCE(\"Func.refGene\", '')) IN (SELECT TRIM(UNNEST(string_split(?, ','))))");
        if (hasExonic) conditions.add("TRIM(COALESCE(\"ExonicFunc.refGene\", '')) IN (SELECT TRIM(UNNEST(string_split(?, ','))))");
        if (hasChr) conditions.add("TRIM(COALESCE(CAST(Chr AS VARCHAR), '')) IN (SELECT TRIM(UNNEST(string_split(?, ','))))");
        if (hasSample) conditions.add("COALESCE(CAST(Tumor_Sample_Barcode AS VARCHAR), '') = ?");
        if (hasStartMin) conditions.add("TRY_CAST(Start AS BIGINT) >= ?");
        if (hasStartMax) conditions.add("TRY_CAST(Start AS BIGINT) <= ?");
        if (conditions.isEmpty()) return "";
        return "WHERE " + String.join(" AND ", conditions) + " ";
    }

    public List<DataFileDto> listDataFiles() {
        List<DataFileDto> files = new ArrayList<>();
        for (String cancer : CANCERS) {
            Path multianno = resolveAggregateMultianno(cancer);
            if (Files.isRegularFile(multianno)) {
                files.add(buildDataFileDto(cancer, "Variant Data", multianno,
                        "/api/v1/data-files/" + cancer + "/" + multianno.getFileName()));
            }
            Path mafDir = resolveCancerDir(cancer).resolve("maf");
            if (Files.isDirectory(mafDir)) {
                try (Stream<Path> stream = Files.list(mafDir)) {
                    stream.filter(Files::isRegularFile)
                            .filter(p -> !p.getFileName().toString().endsWith(".maf"))
                            .sorted()
                            .forEach(p -> files.add(buildDataFileDto(cancer, "MAF Summary", p,
                                    "/api/v1/data-files/" + cancer + "/maf/" + p.getFileName())));
                } catch (IOException e) {
                    log.warn("Failed to scan maf dir for {}", cancer, e);
                }
            }
        }
        Path[] panCancerFiles = {dataDir.resolve("all_sample_152.txt"), dataDir.resolve("all_sample_33.txt")};
        for (Path p : panCancerFiles) {
            if (Files.isRegularFile(p)) {
                files.add(buildDataFileDto("Pan-Cancer", "Pan-Cancer Variants", p,
                        "/api/v1/data-files/pan/" + p.getFileName()));
            }
        }
        return files;
    }

    public Resource loadDataFile(String category, String subPath) {
        Path filePath;
        if ("pan".equalsIgnoreCase(category)) {
            filePath = dataDir.resolve(subPath);
        } else {
            String cancer = validateCancer(category);
            filePath = resolveCancerDir(cancer).resolve(subPath);
        }
        if (!Files.isRegularFile(filePath)) {
            throw new ResourceNotFoundException("Data file not found: " + subPath);
        }
        return new FileSystemResource(filePath);
    }

    private DataFileDto buildDataFileDto(String cancer, String fileType, Path path, String downloadUrl) {
        long size = 0;
        try { size = Files.size(path); } catch (IOException ignored) {}
        String name = humanizeFileName(path.getFileName().toString());
        return new DataFileDto(cancer, fileType, name, path.getFileName().toString(), size, downloadUrl);
    }

    public DatabaseStatsDto getDatabaseStats() {
        String sql =
                "WITH gene_counts AS (" +
                        "  SELECT DISTINCT TRIM(gene_name) AS gene_name " +
                        "  FROM (" +
                        "    SELECT UNNEST(STRING_SPLIT(COALESCE(\"Gene.refGene\", ''), ';')) AS gene_name FROM aggregate_multianno" +
                        "  ) split_genes " +
                        "  WHERE TRIM(gene_name) <> '' AND TRIM(gene_name) <> '.'" +
                        ") " +
                        "SELECT " +
                        "  (SELECT COUNT(*) FROM aggregate_multianno) AS total_variants, " +
                        "  (SELECT COUNT(*) FROM sample_inventory) AS total_samples, " +
                        "  (SELECT COUNT(*) FROM gene_counts) AS total_genes, " +
                        "  (SELECT COUNT(DISTINCT cancer_type) FROM aggregate_multianno) AS cohort_count";
        try (Connection conn = openMafConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            if (rs.next()) {
                return new DatabaseStatsDto(
                        rs.getLong("total_variants"),
                        rs.getLong("total_samples"),
                        rs.getLong("total_genes"),
                        rs.getInt("cohort_count"));
            }
        } catch (SQLException e) {
            log.warn("Stats query failed: {}", e.getMessage());
        }
        return new DatabaseStatsDto(0, 0, 0, 0);
    }

    public List<String> getAllGenes(String cancer) {
        String readExpr = resolveMultiCancerReadExpr(cancer);
        if (readExpr == null) return List.of();
        String sql = "SELECT DISTINCT TRIM(gene_name) AS gene " +
                "FROM (" +
                "  SELECT UNNEST(STRING_SPLIT(COALESCE(\"Gene.refGene\", ''), ';')) AS gene_name " +
                "  FROM " + readExpr +
                ") split_genes " +
                "WHERE TRIM(gene_name) <> '' AND TRIM(gene_name) <> '.' " +
                "ORDER BY gene ASC";
        List<String> results = new ArrayList<>();
        try (Connection connection = openMafConnection();
             Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery(sql)) {
            while (rs.next()) results.add(rs.getString("gene"));
            return results;
        } catch (SQLException exception) {
            log.warn("getAllGenes failed for {}: {}", cancer, exception.getMessage());
            return List.of();
        }
    }

    public List<String> getGeneSuggestions(String cancer, String query, int limit) {
        String readExpr = resolveMultiCancerReadExpr(cancer);
        if (readExpr == null || query == null || query.isBlank()) return List.of();
        String q = query.trim().toLowerCase(Locale.ROOT);
        String sql = "SELECT DISTINCT TRIM(gene_name) AS gene " +
                "FROM (" +
                "  SELECT UNNEST(STRING_SPLIT(COALESCE(\"Gene.refGene\", ''), ';')) AS gene_name " +
                "  FROM " + readExpr +
                ") split_genes " +
                "WHERE TRIM(gene_name) <> '' AND TRIM(gene_name) <> '.' " +
                "  AND LOWER(TRIM(gene_name)) LIKE '" + q + "%' " +
                "ORDER BY gene ASC " +
                "LIMIT " + limit;
        List<String> results = new ArrayList<>();
        try (Connection connection = openMafConnection();
             Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery(sql)) {
            while (rs.next()) {
                results.add(rs.getString("gene"));
            }
            return results;
        } catch (SQLException exception) {
            log.warn("Gene suggestion query failed for {} / {}: {}", cancer, query, exception.getMessage());
            return List.of();
        }
    }

    public List<LabelCountDto> getFuncDistribution(String cancer) {
        return queryLabelCounts(cancer,
                "SELECT TRIM(COALESCE(\"Func.refGene\", '')) AS label, COUNT(*) AS cnt " +
                "FROM %s " +
                "WHERE TRIM(COALESCE(\"Func.refGene\", '')) <> '' " +
                "GROUP BY label ORDER BY cnt DESC");
    }

    public List<LabelCountDto> getExonicDistribution(String cancer) {
        return queryLabelCounts(cancer,
                "SELECT TRIM(COALESCE(\"ExonicFunc.refGene\", '')) AS label, COUNT(*) AS cnt " +
                "FROM %s " +
                "WHERE TRIM(COALESCE(\"ExonicFunc.refGene\", '')) <> '' " +
                "  AND TRIM(COALESCE(\"ExonicFunc.refGene\", '')) <> '.' " +
                "GROUP BY label ORDER BY cnt DESC");
    }

    public List<LabelCountDto> getChromDistribution(String cancer) {
        return queryLabelCounts(cancer,
                "SELECT TRIM(COALESCE(CAST(Chr AS VARCHAR), '')) AS label, COUNT(*) AS cnt " +
                "FROM %s " +
                "WHERE TRIM(COALESCE(CAST(Chr AS VARCHAR), '')) <> '' " +
                "GROUP BY label " +
                "ORDER BY TRY_CAST(REGEXP_REPLACE(label, '^chr', '') AS INTEGER) NULLS LAST, label ASC");
    }

    public List<LabelCountDto> getSampleBurden(String cancer, int limit) {
        return queryLabelCounts(cancer,
                "SELECT TRIM(COALESCE(CAST(Tumor_Sample_Barcode AS VARCHAR), '')) AS label, COUNT(*) AS cnt " +
                "FROM %s " +
                "WHERE TRIM(COALESCE(CAST(Tumor_Sample_Barcode AS VARCHAR), '')) <> '' " +
                "GROUP BY label ORDER BY cnt DESC LIMIT " + limit);
    }

    private List<LabelCountDto> queryLabelCounts(String cancer, String sqlTemplate) {
        String readExpr = resolveMultiCancerReadExpr(cancer);
        if (readExpr == null) return List.of();
        String sql = sqlTemplate.formatted(readExpr);
        List<LabelCountDto> results = new ArrayList<>();
        try (Connection connection = openMafConnection();
             Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery(sql)) {
            while (rs.next()) {
                results.add(new LabelCountDto(rs.getString("label"), rs.getLong("cnt")));
            }
            return results;
        } catch (SQLException exception) {
            log.warn("Label-count query failed for {} : {}", cancer, exception.getMessage());
            return List.of();
        }
    }

    public List<CancerAssetDto> getCancerAssets(String cancer) {
        String validatedCancer = validateCancer(cancer);
        String sql = "SELECT category, title, file_name, size_bytes FROM statistics_asset_index " +
                "WHERE cancer_type = ? AND asset_type = 'cancer_asset' " +
                "ORDER BY category ASC, file_name ASC";
        List<CancerAssetDto> assets = new ArrayList<>();
        try (Connection connection = openMafConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, validatedCancer);
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    String fileName = rs.getString("file_name");
                    assets.add(new CancerAssetDto(
                            rs.getString("category"),
                            rs.getString("title"),
                            fileName,
                            rs.getLong("size_bytes"),
                            "/api/v1/cancers/assets/" + validatedCancer + "/file/" +
                                    UriUtils.encodePathSegment(fileName, StandardCharsets.UTF_8)));
                }
            }
            return assets;
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to list cancer assets for " + validatedCancer, exception);
        }
    }

    public CancerAssetResource loadCancerAsset(String cancer, String fileName) {
        String validatedCancer = validateCancer(cancer);
        String sql = "SELECT file_path, size_bytes FROM statistics_asset_index " +
                "WHERE cancer_type = ? AND asset_type = 'cancer_asset' AND file_name = ? " +
                "ORDER BY category ASC LIMIT 1";
        try (Connection connection = openMafConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, validatedCancer);
            statement.setString(2, fileName);
            try (ResultSet rs = statement.executeQuery()) {
                if (!rs.next()) {
                    throw new ResourceNotFoundException("Cancer asset not found: " + fileName);
                }
                Path filePath = Path.of(rs.getString("file_path"));
                return new CancerAssetResource(new FileSystemResource(filePath), fileName, "application/pdf", rs.getLong("size_bytes"));
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load cancer asset " + fileName, exception);
        }
    }

    // ---- Gene lollipop plots ----

    /**
     * Lists lollipop PDF plots for a gene across the specified cohorts.
     * If cancers is null or empty, scans all 15 supported cohorts.
     */
    public List<GenePlotDto> getGeneLollipopPlots(String gene, List<String> cancers) {
        String geneUpper = gene.toUpperCase(Locale.ROOT);
        List<String> targets = (cancers == null || cancers.isEmpty()) ? CANCERS : cancers.stream()
                .map(value -> {
                    try {
                        return validateCancer(value);
                    } catch (IllegalArgumentException exception) {
                        return null;
                    }
                })
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        String inClause = targets.stream().map(value -> "?").collect(Collectors.joining(","));
        String sql = "SELECT cancer_type, file_name, gene_name, chromosome, start_position, end_position " +
                "FROM statistics_asset_index WHERE asset_type = 'gene_plot' AND source = 'Overview' " +
                "AND UPPER(COALESCE(gene_name, '')) = ?";
        if (!targets.isEmpty()) {
            sql += " AND cancer_type IN (" + inClause + ")";
        }
        sql += " ORDER BY cancer_type ASC, file_name ASC";

        List<GenePlotDto> results = new ArrayList<>();
        try (Connection connection = openMafConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            int idx = 1;
            statement.setString(idx++, geneUpper);
            for (String cancer : targets) {
                statement.setString(idx++, cancer);
            }
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    String cancerType = rs.getString("cancer_type");
                    String fileName = rs.getString("file_name");
                    results.add(new GenePlotDto(
                            fileName,
                            "/api/v1/gene-plots/" + UriUtils.encodePathSegment(cancerType, StandardCharsets.UTF_8)
                                    + "/file/" + UriUtils.encodePathSegment(fileName, StandardCharsets.UTF_8),
                            cancerType,
                            rs.getString("gene_name"),
                            rs.getString("chromosome"),
                            rs.getString("start_position"),
                            rs.getString("end_position")));
                }
            }
            return results;
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to list gene lollipop plots for " + gene, exception);
        }
    }

    public CancerAssetResource loadGenePlot(String cancer, String fileName) {
        String validatedCancer = validateCancer(cancer);
        String sql = "SELECT file_path, size_bytes FROM statistics_asset_index " +
                "WHERE cancer_type = ? AND asset_type = 'gene_plot' AND source = 'Overview' AND file_name = ? LIMIT 1";
        try (Connection connection = openMafConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, validatedCancer);
            statement.setString(2, fileName);
            try (ResultSet rs = statement.executeQuery()) {
                if (!rs.next()) {
                    throw new ResourceNotFoundException("Gene plot not found: " + fileName);
                }
                return new CancerAssetResource(new FileSystemResource(Path.of(rs.getString("file_path"))),
                        fileName, "application/pdf", rs.getLong("size_bytes"));
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Cannot read gene plot: " + fileName, exception);
        }
    }

    private boolean matchesGenePlot(String fileName, String cancer, String geneUpper) {
        // Expected: lollipop_CFDNA_{Cancer}_{Gene}_{Chr}_{Start}_{End}.pdf
        String[] parts = fileName.replace(".pdf", "").split("_");
        if (parts.length < 5) return false;
        return parts[2].equalsIgnoreCase(cancer) && parts[3].toUpperCase(Locale.ROOT).equals(geneUpper);
    }

    private GenePlotDto parseGenePlot(Path file, String cancer) {
        try {
            String fileName = file.getFileName().toString();
            String[] parts = fileName.replace(".pdf", "").split("_");
            // parts: [lollipop, CFDNA, {Cancer}, {Gene}, {Chr}, {Start}, {End}]
            if (parts.length < 7) return null;
            String gene = parts[3];
            String chr = parts[4];
            String start = parts[5];
            String end = parts[6];
            String url = "/api/v1/gene-plots/" + UriUtils.encodePathSegment(cancer, StandardCharsets.UTF_8)
                    + "/file/" + UriUtils.encodePathSegment(fileName, StandardCharsets.UTF_8);
            return new GenePlotDto(fileName, url, cancer, gene, chr, start, end);
        } catch (Exception e) {
            log.warn("Could not parse gene plot filename: {}", file.getFileName());
            return null;
        }
    }

    // ---- MAF Mutation queries (.duckdb database) ----

    private static final String MAF_DB_DEFAULT_FILE = "cfdnadb.duckdb";
    private static final String CFDNA_MAF_TABLE = "cfdna_maf";
    private static final String TCGA_MAF_TABLE = "tcga_maf";
    private static final String GEO_MAF_TABLE = "geo_maf";
    private static final String ALL_CFDNA_MAF_VIEW = "all_cfdna_maf";

    /**
     * Maps frontend cancer names to the cancer_type values stored in the cfdna_maf table.
     * Values come from the Cancer_Type column of cfDNA_MAF_Mutations.tsv.
     */
    private static final Map<String, String> CANCER_TO_CFDNA_TYPE = Map.ofEntries(
            Map.entry("Breast",      "Breast"),
            Map.entry("Colorectal",  "CRC"),
            Map.entry("Liver",       "Liver"),
            Map.entry("Lung",        "Lung"),
            Map.entry("Pancreatic",  "PDAC"),
            Map.entry("Bladder",     "Bladder"),
            Map.entry("Cervical",    "Cervical"),
            Map.entry("Endometrial", "Endometrium"),
            Map.entry("Esophageal",  "Esophageal"),
            Map.entry("Gastric",     "Gastric"),
            Map.entry("HeadAndNeck", "Head_and_neck"),
            Map.entry("Kidney",      "Kidney"),
            Map.entry("Ovarian",     "Ovarian"),
            Map.entry("Thyroid",     "Thyriod"),  // typo preserved from source data
            Map.entry("Brain",       "Brain"),
            Map.entry("NGY",         "NGY")
    );

    /**
     * Maps frontend cancer names to the TCGA oncoplot matrix filename prefix.
     * Files live at {dataDir}/{Cancer}/stats/oncoplot/oncoplot_matrix_TCGA_{suffix}.txt
     */
    private static final Map<String, String> CANCER_TO_TCGA_MATRIX = Map.ofEntries(
            Map.entry("Breast",      "BRCA"),
            Map.entry("Colorectal",  "COAD"),
            Map.entry("Liver",       "LIHC"),
            Map.entry("Lung",        "LUAD"),
            Map.entry("Pancreatic",  "PAAD"),
            Map.entry("Bladder",     "BLCA"),
            Map.entry("Cervical",    "CESC"),
            Map.entry("Endometrial", "UCEC"),
            Map.entry("Esophageal",  "ESCA"),
            Map.entry("Gastric",     "STAD"),
            Map.entry("HeadAndNeck", "HNSC"),
            Map.entry("Kidney",      "KIRC"),
            Map.entry("Ovarian",     "OV"),
            Map.entry("Thyroid",     "THCA"),
            Map.entry("Brain",       "GBM")
    );

    private static final Map<String, String> TCGA_TYPE_TO_CANCER = Map.ofEntries(
            Map.entry("BLCA", "Bladder"),
            Map.entry("BRCA", "Breast"),
            Map.entry("CESC", "Cervical"),
            Map.entry("COAD", "Colorectal"),
            Map.entry("ESCA", "Esophageal"),
            Map.entry("GBM", "Brain"),
            Map.entry("HNSC", "HeadAndNeck"),
            Map.entry("KIRC", "Kidney"),
            Map.entry("LIHC", "Liver"),
            Map.entry("LUAD", "Lung"),
            Map.entry("OV", "Ovarian"),
            Map.entry("PAAD", "Pancreatic"),
            Map.entry("STAD", "Gastric"),
            Map.entry("THCA", "Thyroid"),
            Map.entry("UCEC", "Endometrial")
    );

    /**
     * Maps frontend cancer names to CancerType values in clinical_data.txt.
     * Each cancer can map to multiple CancerType values (e.g. Lung has CFDNA_Lung + EGA_Lung).
     */
    private static final Map<String, List<String>> CANCER_TO_PAN_CANCER_TYPES = Map.ofEntries(
            Map.entry("Breast",      List.of("CFDNA_Breast")),
            Map.entry("Colorectal",  List.of("CFDNA_CRC")),
            Map.entry("Liver",       List.of("CFDNA_Liver")),
            Map.entry("Lung",        List.of("CFDNA_Lung", "EGA_Lung")),
            Map.entry("Pancreatic",  List.of("CFDNA_PDAC")),
            Map.entry("Bladder",     List.of("CFDNA_Bladder")),
            Map.entry("Cervical",    List.of("CFDNA_Cervical")),
            Map.entry("Endometrial", List.of("CFDNA_Endometrium")),
            Map.entry("Esophageal",  List.of("CFDNA_Esophageal")),
            Map.entry("Gastric",     List.of("CFDNA_Gastric")),
            Map.entry("HeadAndNeck", List.of("CFDNA_Head_and_neck")),
            Map.entry("Kidney",      List.of("CFDNA_Kidney")),
            Map.entry("Ovarian",     List.of("CFDNA_Ovarian")),
            Map.entry("Thyroid",     List.of("CFDNA_Thyriod")),
            Map.entry("Brain",       List.of("CFDNA_Brain")),
            Map.entry("NGY",         List.of("CFDNA_NGY"))
    );

    private static final String PAN_CANCER_CLINICAL_FILE = "clinical_data.txt";
    private static final String PAN_CANCER_MUTATIONS_FILE = "mutations_data.txt";

    private Path resolveMafDatabaseFile() {
        return dataDir.resolve(queryDbFileName == null || queryDbFileName.isBlank() ? MAF_DB_DEFAULT_FILE : queryDbFileName);
    }

    private boolean isTcga(String source) {
        return "TCGA".equalsIgnoreCase(source);
    }

    private boolean isGeo(String source) {
        return "GEO".equalsIgnoreCase(source);
    }

    /** Return the SELECT fragment for detail columns that may not exist in every MAF table. */
    private String mafDetailColumns(String source) {
        if (isGeo(source)) {
            return "  COALESCE(functional_region, '') AS functional_region, " +
                    "  COALESCE(aa_change_refgene, '') AS aa_change, " +
                    "  '' AS transcript, '' AS exon, '' AS exonic_function ";
        }
        return "  COALESCE(transcript, '') AS transcript, " +
                "  COALESCE(exon, '') AS exon, " +
                "  COALESCE(aa_change, '') AS aa_change, " +
                "  COALESCE(functional_region, '') AS functional_region, " +
                "  COALESCE(exonic_function, '') AS exonic_function ";
    }

    private boolean tcgaIgvFileAvailable() {
        return Files.isRegularFile(tcgaIgvFile);
    }

    private String resolveTcgaIgvReadExpr() {
        String normalizedPath = tcgaIgvFile.toAbsolutePath().toString().replace("\\", "/").replace("'", "''");
        return "(SELECT " +
                "COALESCE(CAST(Hugo_Symbol AS VARCHAR), '') AS hugo_symbol, " +
                "COALESCE(CAST(cancer_type AS VARCHAR), '') AS cancer_type, " +
                "COALESCE(CAST(Chromosome AS VARCHAR), '') AS chromosome, " +
                "COALESCE(CAST(Start_Position AS VARCHAR), '') AS start_position, " +
                "COALESCE(CAST(End_Position AS VARCHAR), '') AS end_position, " +
                "COALESCE(CAST(Reference_Allele AS VARCHAR), '') AS reference_allele, " +
                "COALESCE(CAST(Tumor_Seq_Allele2 AS VARCHAR), '') AS tumor_seq_allele2, " +
                "COALESCE(CAST(Variant_Classification AS VARCHAR), '') AS variant_classification, " +
                "COALESCE(CAST(Variant_Type AS VARCHAR), '') AS variant_type, " +
                "COALESCE(CAST(Tumor_Sample_Barcode AS VARCHAR), '') AS tumor_sample_barcode, " +
                "'' AS transcript, '' AS exon, '' AS aa_change, '' AS functional_region, '' AS exonic_function " +
                "FROM read_csv_auto('" + normalizedPath + "', delim='\\t', header=true, all_varchar=true, ignore_errors=true))";
    }

    private List<String> normalizeTcgaIgvCancerTypes(List<String> cancerTypes) {
        return normalizeFilterValues(cancerTypes).stream()
                .map(value -> {
                    String tcgaCode = CANCER_TO_TCGA_MATRIX.get(value);
                    if (tcgaCode != null) {
                        return "TCGA_" + tcgaCode;
                    }
                    String normalized = value.toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
                    if (normalized.startsWith("TCGA_")) {
                        return normalized;
                    }
                    if (TCGA_TYPE_TO_CANCER.containsKey(normalized)) {
                        return "TCGA_" + normalized;
                    }
                    return normalized;
                })
                .distinct()
                .toList();
    }

    private String normalizeTcgaCancerDisplay(String cancerType) {
        if (cancerType == null || cancerType.isBlank()) {
            return "";
        }
        String normalized = cancerType.trim().toUpperCase(Locale.ROOT).replace('-', '_');
        if (normalized.startsWith("TCGA_")) {
            normalized = normalized.substring("TCGA_".length());
        }
        return TCGA_TYPE_TO_CANCER.getOrDefault(normalized, cancerType);
    }

    private String normalizeTcgaCancerPreview(String preview) {
        if (preview == null || preview.isBlank() || "-".equals(preview)) {
            return preview;
        }
        return Arrays.stream(preview.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .map(this::normalizeTcgaCancerDisplay)
                .distinct()
                .collect(Collectors.joining(", "));
    }

    private boolean isPrivate(String source) {
        return "private".equalsIgnoreCase(source);
    }

    private String resolveMafTable(String source) {
        if (isTcga(source)) return TCGA_MAF_TABLE;
        if (isGeo(source)) return GEO_MAF_TABLE;
        if (isPrivate(source)) return CFDNA_MAF_TABLE;
        // "cfDNA" default → union view if available, else fall back to private table
        return allCfdnaViewAvailable() ? ALL_CFDNA_MAF_VIEW : CFDNA_MAF_TABLE;
    }

    private boolean allCfdnaViewAvailable() {
        if (!mafDatabaseAvailable()) return false;
        try (Connection conn = openMafConnection()) {
            return mafTableExists(conn, ALL_CFDNA_MAF_VIEW);
        } catch (SQLException e) {
            return false;
        }
    }

    private Connection openMafConnection() throws SQLException {
        Path mafDb = resolveMafDatabaseFile().toAbsolutePath();
        if (!Files.isRegularFile(mafDb)) {
            throw new IllegalStateException("Query database file not found: " + mafDb);
        }
        return DriverManager.getConnection("jdbc:duckdb:" + mafDb.toString());
    }

    private boolean mafDatabaseAvailable() {
        Path mafDb = resolveMafDatabaseFile();
        return Files.isRegularFile(mafDb) && Files.isReadable(mafDb);
    }

    private boolean mafTableExists(Connection connection, String tableName) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT COUNT(*) FROM (" +
                        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main' AND table_name = ? " +
                        "UNION ALL " +
                        "SELECT view_name FROM duckdb_views() WHERE schema_name = 'main' AND view_name = ?" +
                        ")")) {
            statement.setString(1, tableName);
            statement.setString(2, tableName);
            try (ResultSet resultSet = statement.executeQuery()) {
                resultSet.next();
                return resultSet.getLong(1) > 0;
            }
        }
    }

    public MafFilterOptionsDto getMafFilterOptions(String source) {
        Path mafDb = resolveMafDatabaseFile();
        String table = resolveMafTable(source);
        log.info("[MAF] getMafFilterOptions source={}, db={}, exists={}, table={}",
                source, mafDb.toAbsolutePath(), mafDatabaseAvailable(), table);
        if (!mafDatabaseAvailable()) {
            log.warn("[MAF] Database file not found: {}", mafDb.toAbsolutePath());
            return new MafFilterOptionsDto(source, List.of(), List.of(), List.of(), List.of());
        }

        List<String> cancerTypes = new ArrayList<>();
        List<String> chromosomes = new ArrayList<>();
        List<String> variantClassifications = new ArrayList<>();
        List<String> variantTypes = new ArrayList<>();

        try (Connection conn = openMafConnection();
             Statement stmt = conn.createStatement()) {
            if (!mafTableExists(conn, table)) {
                log.warn("[MAF] Table not found in {}: {}", mafDb.toAbsolutePath(), table);
                return new MafFilterOptionsDto(source, List.of(), List.of(), List.of(), List.of());
            }

            if (!isTcga(source)) {
                try (ResultSet rs = stmt.executeQuery(
                        "SELECT DISTINCT cancer_type FROM " + table +
                                " WHERE NULLIF(TRIM(cancer_type), '') IS NOT NULL ORDER BY cancer_type")) {
                    while (rs.next()) cancerTypes.add(rs.getString(1));
                }
            }
            try (ResultSet rs = stmt.executeQuery(
                    "SELECT DISTINCT chromosome FROM " + table +
                            " WHERE NULLIF(TRIM(chromosome), '') IS NOT NULL ORDER BY chromosome")) {
                while (rs.next()) chromosomes.add(rs.getString(1));
            }
            try (ResultSet rs = stmt.executeQuery(
                    "SELECT DISTINCT variant_classification FROM " + table +
                            " WHERE NULLIF(TRIM(variant_classification), '') IS NOT NULL ORDER BY variant_classification")) {
                while (rs.next()) variantClassifications.add(rs.getString(1));
            }
            try (ResultSet rs = stmt.executeQuery(
                    "SELECT DISTINCT variant_type FROM " + table +
                            " WHERE NULLIF(TRIM(variant_type), '') IS NOT NULL ORDER BY variant_type")) {
                while (rs.next()) variantTypes.add(rs.getString(1));
            }
            log.info("[MAF] filter-options loaded from {}: cancerTypes={}, chromosomes={}, variantClassifications={}, variantTypes={}",
                    table, cancerTypes.size(), chromosomes.size(), variantClassifications.size(), variantTypes.size());
        } catch (SQLException e) {
            log.error("[MAF] SQL failed for filter-options source={}: {}", source, e.getMessage(), e);
        }
        return new MafFilterOptionsDto(source, cancerTypes, chromosomes, variantClassifications, variantTypes);
    }

    public PagedResponse<MafGeneSummaryDto> queryMafGenes(String source, String gene, String sample, List<String> cancerTypes,
                                                          List<String> chromosomes, List<String> variantClasses, List<String> variantTypes,
                                                          int page, int pageSize) {
        Path mafDb = resolveMafDatabaseFile();
        String table = resolveMafTable(source);
        log.info("[MAF] queryMafGenes source={}, db={}, exists={}, table={}",
                source, mafDb.toAbsolutePath(), mafDatabaseAvailable(), table);
        if (!mafDatabaseAvailable()) {
            log.warn("[MAF] Database file not found: {}", mafDb.toAbsolutePath());
            return new PagedResponse<>(List.of(), page, pageSize, 0, 0, true, true);
        }

        boolean tcga = isTcga(source);
        boolean hasGene = gene != null && !gene.isBlank();
        boolean hasSample = sample != null && !sample.isBlank();
        List<String> normalizedCancerTypes = normalizeFilterValues(cancerTypes);
        List<String> normalizedChromosomes = normalizeChromosomeFilterValues(chromosomes);
        List<String> normalizedVariantClasses = normalizeFilterValues(variantClasses);
        List<String> normalizedVariantTypes = normalizeFilterValues(variantTypes);
        String where = buildMafWhereClause(hasGene, hasSample, normalizedCancerTypes, normalizedChromosomes, normalizedVariantClasses, normalizedVariantTypes, tcga);
        String nonBlankGeneCondition = "NULLIF(TRIM(COALESCE(hugo_symbol, '')), '') IS NOT NULL";
        String groupedWhere = where.isEmpty() ? "WHERE " + nonBlankGeneCondition + " " : where + "AND " + nonBlankGeneCondition + " ";

        String coordinateExpr =
                "CASE " +
                        "WHEN NULLIF(TRIM(COALESCE(chromosome, '')), '') IS NOT NULL AND NULLIF(TRIM(COALESCE(start_position, '')), '') IS NOT NULL " +
                        "THEN COALESCE(chromosome, '') || ':' || COALESCE(start_position, '') || " +
                        "CASE " +
                        "WHEN NULLIF(TRIM(COALESCE(end_position, '')), '') IS NOT NULL AND COALESCE(end_position, '') <> COALESCE(start_position, '') " +
                        "THEN '-' || COALESCE(end_position, '') " +
                        "ELSE '' END " +
                        "ELSE NULL END";

        String countSql =
                "SELECT COUNT(*) AS total FROM (" +
                        "SELECT hugo_symbol FROM " + table + " " + groupedWhere +
                        "GROUP BY hugo_symbol" +
                        ") gene_rows";

        String dataSql =
                "SELECT " +
                        "COALESCE(hugo_symbol, '') AS hugo_symbol, " +
                        "COUNT(*) AS total_variants, " +
                        "COUNT(DISTINCT NULLIF(tumor_sample_barcode, '')) AS total_samples, " +
                        "COUNT(DISTINCT " + coordinateExpr + ") AS total_coordinates " +
                        "FROM " + table + " " +
                        groupedWhere +
                        "GROUP BY hugo_symbol " +
                        "ORDER BY total_variants DESC, hugo_symbol ASC " +
                        "LIMIT ? OFFSET ?";

        try (Connection conn = openMafConnection()) {
            if (!mafTableExists(conn, table)) {
                log.warn("[MAF] Table not found in {}: {}", mafDb.toAbsolutePath(), table);
                return new PagedResponse<>(List.of(), page, pageSize, 0, 0, true, true);
            }

            long totalRows;
            try (PreparedStatement countStmt = conn.prepareStatement(countSql)) {
                bindMafParams(countStmt, 1, hasGene, gene, hasSample, sample, normalizedCancerTypes, normalizedChromosomes, normalizedVariantClasses, normalizedVariantTypes, tcga);
                try (ResultSet rs = countStmt.executeQuery()) {
                    rs.next();
                    totalRows = rs.getLong("total");
                }
            }
            if (totalRows == 0) {
                return new PagedResponse<>(List.of(), page, pageSize, 0, 0, true, true);
            }

            int offset = Math.max(page - 1, 0) * pageSize;
            List<MafGeneSummaryDto> content = new ArrayList<>();
            try (PreparedStatement dataStmt = conn.prepareStatement(dataSql)) {
                int idx = bindMafParams(dataStmt, 1, hasGene, gene, hasSample, sample, normalizedCancerTypes, normalizedChromosomes, normalizedVariantClasses, normalizedVariantTypes, tcga);
                dataStmt.setInt(idx++, pageSize);
                dataStmt.setInt(idx, offset);
                try (ResultSet rs = dataStmt.executeQuery()) {
                    while (rs.next()) {
                        String geneSymbol = rs.getString("hugo_symbol");
                        content.add(buildMafGeneSummaryDto(
                                conn,
                                table,
                                geneSymbol,
                                rs.getLong("total_variants"),
                                rs.getLong("total_samples"),
                                rs.getLong("total_coordinates"),
                                hasSample,
                                sample,
                                normalizedCancerTypes,
                                normalizedChromosomes,
                                normalizedVariantClasses,
                                normalizedVariantTypes,
                                tcga));
                    }
                }
            }

            int totalPages = (int) Math.ceil(totalRows / (double) pageSize);
            boolean first = page <= 1;
            boolean last = totalPages == 0 || page >= totalPages;
            return new PagedResponse<>(content, page, pageSize, totalRows, totalPages, first, last);
        } catch (SQLException e) {
            log.error("[MAF] Gene summary query failed for source={}: {}", source, e.getMessage(), e);
            return new PagedResponse<>(List.of(), page, pageSize, 0, 0, true, true);
        }
    }

    public MafGeneSummaryDto getMafGeneDetail(String source, String gene, String sample, List<String> cancerTypes,
                                              List<String> chromosomes, List<String> variantClasses, List<String> variantTypes) {
        if (isTcga(source) && tcgaIgvFileAvailable()) {
            return getTcgaIgvGeneDetail(gene, sample, cancerTypes, chromosomes, variantClasses, variantTypes);
        }

        Path mafDb = resolveMafDatabaseFile();
        String table = resolveMafTable(source);
        if (!mafDatabaseAvailable()) {
            throw new ResourceNotFoundException("MAF database is not available.");
        }

        boolean tcga = isTcga(source);
        boolean hasSample = sample != null && !sample.isBlank();
        List<String> normalizedCancerTypes = normalizeFilterValues(cancerTypes);
        List<String> normalizedChromosomes = normalizeChromosomeFilterValues(chromosomes);
        List<String> normalizedVariantClasses = normalizeFilterValues(variantClasses);
        List<String> normalizedVariantTypes = normalizeFilterValues(variantTypes);

        String coordinateExpr =
                "CASE " +
                        "WHEN NULLIF(TRIM(COALESCE(chromosome, '')), '') IS NOT NULL AND NULLIF(TRIM(COALESCE(start_position, '')), '') IS NOT NULL " +
                        "THEN COALESCE(chromosome, '') || ':' || COALESCE(start_position, '') || " +
                        "CASE " +
                        "WHEN NULLIF(TRIM(COALESCE(end_position, '')), '') IS NOT NULL AND COALESCE(end_position, '') <> COALESCE(start_position, '') " +
                        "THEN '-' || COALESCE(end_position, '') " +
                        "ELSE '' END " +
                        "ELSE NULL END";

        String where = buildMafExactGeneWhereClause(hasSample, normalizedCancerTypes, normalizedChromosomes, normalizedVariantClasses, normalizedVariantTypes, tcga);
        String sql =
                "SELECT " +
                        "COUNT(*) AS total_variants, " +
                        "COUNT(DISTINCT NULLIF(tumor_sample_barcode, '')) AS total_samples, " +
                        "COUNT(DISTINCT " + coordinateExpr + ") AS total_coordinates " +
                        "FROM " + table + " " + where;

        try (Connection conn = openMafConnection()) {
            if (!mafTableExists(conn, table)) {
                throw new ResourceNotFoundException("MAF table is unavailable for source " + source + ".");
            }
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                bindMafExactGeneParams(stmt, 1, gene, hasSample, sample, normalizedCancerTypes, normalizedChromosomes, normalizedVariantClasses, normalizedVariantTypes, tcga);
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next() && rs.getLong("total_variants") > 0) {
                        return buildMafGeneSummaryDto(
                                conn,
                                table,
                                gene,
                                rs.getLong("total_variants"),
                                rs.getLong("total_samples"),
                                rs.getLong("total_coordinates"),
                                hasSample,
                                sample,
                                normalizedCancerTypes,
                                normalizedChromosomes,
                                normalizedVariantClasses,
                                normalizedVariantTypes,
                                tcga);
                    }
                }
            }
        } catch (SQLException e) {
            log.error("[MAF] Gene detail query failed for source={}, gene={}: {}", source, gene, e.getMessage(), e);
        }

        throw new ResourceNotFoundException("Gene " + gene + " was not found in the current MAF view.");
    }

    public PagedResponse<MafMutationDto> queryMafMutationsByGene(String source, String gene, String sample, List<String> cancerTypes,
                                                                 List<String> chromosomes, List<String> variantClasses, List<String> variantTypes,
                                                                 int page, int pageSize) {
        if (isTcga(source) && tcgaIgvFileAvailable()) {
            return queryTcgaIgvMutationsByGene(gene, sample, cancerTypes, chromosomes, variantClasses, variantTypes, page, pageSize);
        }

        Path mafDb = resolveMafDatabaseFile();
        String table = resolveMafTable(source);
        log.info("[MAF] queryMafMutationsByGene source={}, gene={}, db={}, exists={}, table={}",
                source, gene, mafDb.toAbsolutePath(), mafDatabaseAvailable(), table);
        if (!mafDatabaseAvailable()) {
            log.warn("[MAF] Database file not found: {}", mafDb.toAbsolutePath());
            return new PagedResponse<>(List.of(), page, pageSize, 0, 0, true, true);
        }

        boolean tcga = isTcga(source);
        boolean hasSample = sample != null && !sample.isBlank();
        List<String> normalizedCancerTypes = normalizeFilterValues(cancerTypes);
        List<String> normalizedChromosomes = normalizeChromosomeFilterValues(chromosomes);
        List<String> normalizedVariantClasses = normalizeFilterValues(variantClasses);
        List<String> normalizedVariantTypes = normalizeFilterValues(variantTypes);

        String where = buildMafExactGeneWhereClause(hasSample, normalizedCancerTypes, normalizedChromosomes, normalizedVariantClasses, normalizedVariantTypes, tcga);
        String countSql = "SELECT COUNT(*) AS total FROM " + table + " " + where;
        String detailCols = mafDetailColumns(source);
        String dataSql = "SELECT " +
                "  COALESCE(hugo_symbol, '') AS hugo_symbol, " +
                "  COALESCE(cancer_type, '') AS cancer_type, " +
                "  COALESCE(chromosome, '') AS chromosome, " +
                "  COALESCE(start_position, '') AS start_position, " +
                "  COALESCE(end_position, '') AS end_position, " +
                "  COALESCE(reference_allele, '') AS reference_allele, " +
                "  COALESCE(tumor_seq_allele2, '') AS tumor_seq_allele2, " +
                "  COALESCE(variant_classification, '') AS variant_classification, " +
                "  COALESCE(variant_type, '') AS variant_type, " +
                "  COALESCE(tumor_sample_barcode, '') AS tumor_sample_barcode, " +
                detailCols +
                "FROM " + table + " " +
                where +
                "ORDER BY chromosome ASC, TRY_CAST(start_position AS BIGINT) ASC NULLS LAST, tumor_sample_barcode ASC " +
                "LIMIT ? OFFSET ?";

        try (Connection conn = openMafConnection()) {
            if (!mafTableExists(conn, table)) {
                log.warn("[MAF] Table not found in {}: {}", mafDb.toAbsolutePath(), table);
                return new PagedResponse<>(List.of(), page, pageSize, 0, 0, true, true);
            }

            long totalRows;
            try (PreparedStatement countStmt = conn.prepareStatement(countSql)) {
                bindMafExactGeneParams(countStmt, 1, gene, hasSample, sample, normalizedCancerTypes, normalizedChromosomes, normalizedVariantClasses, normalizedVariantTypes, tcga);
                try (ResultSet rs = countStmt.executeQuery()) {
                    rs.next();
                    totalRows = rs.getLong("total");
                }
            }
            if (totalRows == 0) {
                return new PagedResponse<>(List.of(), page, pageSize, 0, 0, true, true);
            }

            int offset = Math.max(page - 1, 0) * pageSize;
            List<MafMutationDto> content = new ArrayList<>();
            try (PreparedStatement dataStmt = conn.prepareStatement(dataSql)) {
                int idx = bindMafExactGeneParams(dataStmt, 1, gene, hasSample, sample, normalizedCancerTypes, normalizedChromosomes, normalizedVariantClasses, normalizedVariantTypes, tcga);
                dataStmt.setInt(idx++, pageSize);
                dataStmt.setInt(idx, offset);
                try (ResultSet rs = dataStmt.executeQuery()) {
                    long rowId = offset;
                    while (rs.next()) {
                        content.add(new MafMutationDto(
                                ++rowId,
                                rs.getString("hugo_symbol"),
                                rs.getString("cancer_type"),
                                rs.getString("chromosome"),
                                rs.getString("start_position"),
                                rs.getString("end_position"),
                                rs.getString("reference_allele"),
                                rs.getString("tumor_seq_allele2"),
                                rs.getString("variant_classification"),
                                rs.getString("variant_type"),
                                rs.getString("tumor_sample_barcode"),
                                rs.getString("transcript"),
                                rs.getString("exon"),
                                rs.getString("aa_change"),
                                rs.getString("functional_region"),
                                rs.getString("exonic_function")));
                    }
                }
            }

            int totalPages = (int) Math.ceil(totalRows / (double) pageSize);
            boolean first = page <= 1;
            boolean last = totalPages == 0 || page >= totalPages;
            return new PagedResponse<>(content, page, pageSize, totalRows, totalPages, first, last);
        } catch (SQLException e) {
            log.error("[MAF] Gene mutation table query failed for source={}, gene={}: {}", source, gene, e.getMessage(), e);
            return new PagedResponse<>(List.of(), page, pageSize, 0, 0, true, true);
        }
    }

    public PagedResponse<MafMutationDto> queryMafMutations(String source, String gene, String sample, List<String> cancerTypes,
                                                            List<String> chromosomes, List<String> variantClasses, List<String> variantTypes,
                                                            int page, int pageSize) {
        Path mafDb = resolveMafDatabaseFile();
        String table = resolveMafTable(source);
        log.info("[MAF] queryMafMutations source={}, db={}, exists={}, table={}",
                source, mafDb.toAbsolutePath(), mafDatabaseAvailable(), table);
        if (!mafDatabaseAvailable()) {
            log.warn("[MAF] Database file not found: {}", mafDb.toAbsolutePath());
            return new PagedResponse<>(List.of(), page, pageSize, 0, 0, true, true);
        }
        boolean tcga = isTcga(source);

        boolean hasGene = gene != null && !gene.isBlank();
        boolean hasSample = sample != null && !sample.isBlank();
        List<String> normalizedCancerTypes = normalizeFilterValues(cancerTypes);
        List<String> normalizedChromosomes = normalizeChromosomeFilterValues(chromosomes);
        List<String> normalizedVariantClasses = normalizeFilterValues(variantClasses);
        List<String> normalizedVariantTypes = normalizeFilterValues(variantTypes);

        String where = buildMafWhereClause(hasGene, hasSample, normalizedCancerTypes, normalizedChromosomes, normalizedVariantClasses, normalizedVariantTypes, tcga);

        String detailCols2 = mafDetailColumns(source);
        String countSql = "SELECT COUNT(*) AS total FROM " + table + " " + where;
        String dataSql = "SELECT " +
                "  COALESCE(hugo_symbol, '') AS hugo_symbol, " +
                "  COALESCE(cancer_type, '') AS cancer_type, " +
                "  COALESCE(chromosome, '') AS chromosome, " +
                "  COALESCE(start_position, '') AS start_position, " +
                "  COALESCE(end_position, '') AS end_position, " +
                "  COALESCE(reference_allele, '') AS reference_allele, " +
                "  COALESCE(tumor_seq_allele2, '') AS tumor_seq_allele2, " +
                "  COALESCE(variant_classification, '') AS variant_classification, " +
                "  COALESCE(variant_type, '') AS variant_type, " +
                "  COALESCE(tumor_sample_barcode, '') AS tumor_sample_barcode, " +
                detailCols2 +
                "FROM " + table + " " +
                where +
                "ORDER BY hugo_symbol ASC, chromosome ASC, TRY_CAST(start_position AS BIGINT) ASC NULLS LAST " +
                "LIMIT ? OFFSET ?";

        try (Connection conn = openMafConnection()) {
            if (!mafTableExists(conn, table)) {
                log.warn("[MAF] Table not found in {}: {}", mafDb.toAbsolutePath(), table);
                return new PagedResponse<>(List.of(), page, pageSize, 0, 0, true, true);
            }
            long totalRows;
            try (PreparedStatement countStmt = conn.prepareStatement(countSql)) {
                int idx = 1;
                idx = bindMafParams(countStmt, idx, hasGene, gene, hasSample, sample, normalizedCancerTypes, normalizedChromosomes, normalizedVariantClasses, normalizedVariantTypes, tcga);
                try (ResultSet rs = countStmt.executeQuery()) {
                    rs.next();
                    totalRows = rs.getLong("total");
                }
            }
            if (totalRows == 0) {
                return new PagedResponse<>(List.of(), page, pageSize, 0, 0, true, true);
            }

            int offset = Math.max(page - 1, 0) * pageSize;
            List<MafMutationDto> content = new ArrayList<>();
            try (PreparedStatement dataStmt = conn.prepareStatement(dataSql)) {
                int idx = 1;
                idx = bindMafParams(dataStmt, idx, hasGene, gene, hasSample, sample, normalizedCancerTypes, normalizedChromosomes, normalizedVariantClasses, normalizedVariantTypes, tcga);
                dataStmt.setInt(idx++, pageSize);
                dataStmt.setInt(idx, offset);
                try (ResultSet rs = dataStmt.executeQuery()) {
                    long rowId = offset;
                    while (rs.next()) {
                        content.add(new MafMutationDto(
                                ++rowId,
                                rs.getString("hugo_symbol"),
                                rs.getString("cancer_type"),
                                rs.getString("chromosome"),
                                rs.getString("start_position"),
                                rs.getString("end_position"),
                                rs.getString("reference_allele"),
                                rs.getString("tumor_seq_allele2"),
                                rs.getString("variant_classification"),
                                rs.getString("variant_type"),
                                rs.getString("tumor_sample_barcode"),
                                rs.getString("transcript"),
                                rs.getString("exon"),
                                rs.getString("aa_change"),
                                rs.getString("functional_region"),
                                rs.getString("exonic_function")));
                    }
                }
            }
            int totalPages = (int) Math.ceil(totalRows / (double) pageSize);
            boolean first = page <= 1;
            boolean last = totalPages == 0 || page >= totalPages;
            return new PagedResponse<>(content, page, pageSize, totalRows, totalPages, first, last);
        } catch (SQLException e) {
            log.error("[MAF] SQL query failed for source={}: {}", source, e.getMessage(), e);
            return new PagedResponse<>(List.of(), page, pageSize, 0, 0, true, true);
        }
    }

    private MafGeneSummaryDto getTcgaIgvGeneDetail(String gene, String sample, List<String> cancerTypes,
                                                   List<String> chromosomes, List<String> variantClasses, List<String> variantTypes) {
        String table = resolveTcgaIgvReadExpr();
        boolean hasSample = sample != null && !sample.isBlank();
        List<String> normalizedCancerTypes = normalizeTcgaIgvCancerTypes(cancerTypes);
        List<String> normalizedChromosomes = normalizeChromosomeFilterValues(chromosomes);
        List<String> normalizedVariantClasses = normalizeFilterValues(variantClasses);
        List<String> normalizedVariantTypes = normalizeFilterValues(variantTypes);

        String coordinateExpr =
                "CASE " +
                        "WHEN NULLIF(TRIM(COALESCE(chromosome, '')), '') IS NOT NULL AND NULLIF(TRIM(COALESCE(start_position, '')), '') IS NOT NULL " +
                        "THEN COALESCE(chromosome, '') || ':' || COALESCE(start_position, '') || " +
                        "CASE " +
                        "WHEN NULLIF(TRIM(COALESCE(end_position, '')), '') IS NOT NULL AND COALESCE(end_position, '') <> COALESCE(start_position, '') " +
                        "THEN '-' || COALESCE(end_position, '') " +
                        "ELSE '' END " +
                        "ELSE NULL END";

        String where = buildMafExactGeneWhereClause(hasSample, normalizedCancerTypes, normalizedChromosomes, normalizedVariantClasses, normalizedVariantTypes, false);
        String sql =
                "SELECT " +
                        "COUNT(*) AS total_variants, " +
                        "COUNT(DISTINCT NULLIF(tumor_sample_barcode, '')) AS total_samples, " +
                        "COUNT(DISTINCT " + coordinateExpr + ") AS total_coordinates " +
                        "FROM " + table + " " + where;

        try (Connection conn = openMafConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            bindMafExactGeneParams(stmt, 1, gene, hasSample, sample, normalizedCancerTypes, normalizedChromosomes, normalizedVariantClasses, normalizedVariantTypes, false);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next() && rs.getLong("total_variants") > 0) {
                    MafGeneSummaryDto summary = buildMafGeneSummaryDto(
                            conn,
                            table,
                            gene,
                            rs.getLong("total_variants"),
                            rs.getLong("total_samples"),
                            rs.getLong("total_coordinates"),
                            hasSample,
                            sample,
                            normalizedCancerTypes,
                            normalizedChromosomes,
                            normalizedVariantClasses,
                            normalizedVariantTypes,
                            false);
                    return new MafGeneSummaryDto(
                            summary.getHugoSymbol(),
                            summary.getTotalVariants(),
                            summary.getTotalSamples(),
                            summary.getTotalCoordinates(),
                            normalizeTcgaCancerPreview(summary.getCancerTypesPreview()),
                            summary.getSampleBarcodesPreview(),
                            summary.getCoordinatePreview(),
                            summary.getAllelesPreview(),
                            summary.getVariantClassesPreview(),
                            summary.getVariantTypesPreview(),
                            summary.getAnnotationPreview());
                }
            }
        } catch (SQLException e) {
            log.error("[MAF] TCGA IGV gene detail query failed for gene={}: {}", gene, e.getMessage(), e);
        }

        throw new ResourceNotFoundException("Gene " + gene + " was not found in the current TCGA IGV view.");
    }

    private PagedResponse<MafMutationDto> queryTcgaIgvMutationsByGene(String gene, String sample, List<String> cancerTypes,
                                                                      List<String> chromosomes, List<String> variantClasses, List<String> variantTypes,
                                                                      int page, int pageSize) {
        String table = resolveTcgaIgvReadExpr();
        boolean hasSample = sample != null && !sample.isBlank();
        List<String> normalizedCancerTypes = normalizeTcgaIgvCancerTypes(cancerTypes);
        List<String> normalizedChromosomes = normalizeChromosomeFilterValues(chromosomes);
        List<String> normalizedVariantClasses = normalizeFilterValues(variantClasses);
        List<String> normalizedVariantTypes = normalizeFilterValues(variantTypes);

        String where = buildMafExactGeneWhereClause(hasSample, normalizedCancerTypes, normalizedChromosomes, normalizedVariantClasses, normalizedVariantTypes, false);
        String countSql = "SELECT COUNT(*) AS total FROM " + table + " " + where;
        String dataSql = "SELECT " +
                "  COALESCE(hugo_symbol, '') AS hugo_symbol, " +
                "  COALESCE(cancer_type, '') AS cancer_type, " +
                "  COALESCE(chromosome, '') AS chromosome, " +
                "  COALESCE(start_position, '') AS start_position, " +
                "  COALESCE(end_position, '') AS end_position, " +
                "  COALESCE(reference_allele, '') AS reference_allele, " +
                "  COALESCE(tumor_seq_allele2, '') AS tumor_seq_allele2, " +
                "  COALESCE(variant_classification, '') AS variant_classification, " +
                "  COALESCE(variant_type, '') AS variant_type, " +
                "  COALESCE(tumor_sample_barcode, '') AS tumor_sample_barcode, " +
                "  COALESCE(transcript, '') AS transcript, " +
                "  COALESCE(exon, '') AS exon, " +
                "  COALESCE(aa_change, '') AS aa_change, " +
                "  COALESCE(functional_region, '') AS functional_region, " +
                "  COALESCE(exonic_function, '') AS exonic_function " +
                "FROM " + table + " " +
                where +
                "ORDER BY cancer_type ASC, chromosome ASC, TRY_CAST(start_position AS BIGINT) ASC NULLS LAST, tumor_sample_barcode ASC " +
                "LIMIT ? OFFSET ?";

        try (Connection conn = openMafConnection()) {
            long totalRows;
            try (PreparedStatement countStmt = conn.prepareStatement(countSql)) {
                bindMafExactGeneParams(countStmt, 1, gene, hasSample, sample, normalizedCancerTypes, normalizedChromosomes, normalizedVariantClasses, normalizedVariantTypes, false);
                try (ResultSet rs = countStmt.executeQuery()) {
                    rs.next();
                    totalRows = rs.getLong("total");
                }
            }
            if (totalRows == 0) {
                return new PagedResponse<>(List.of(), page, pageSize, 0, 0, true, true);
            }

            int offset = Math.max(page - 1, 0) * pageSize;
            List<MafMutationDto> content = new ArrayList<>();
            try (PreparedStatement dataStmt = conn.prepareStatement(dataSql)) {
                int idx = bindMafExactGeneParams(dataStmt, 1, gene, hasSample, sample, normalizedCancerTypes, normalizedChromosomes, normalizedVariantClasses, normalizedVariantTypes, false);
                dataStmt.setInt(idx++, pageSize);
                dataStmt.setInt(idx, offset);
                try (ResultSet rs = dataStmt.executeQuery()) {
                    long rowId = offset;
                    while (rs.next()) {
                        content.add(new MafMutationDto(
                                ++rowId,
                                rs.getString("hugo_symbol"),
                                normalizeTcgaCancerDisplay(rs.getString("cancer_type")),
                                rs.getString("chromosome"),
                                rs.getString("start_position"),
                                rs.getString("end_position"),
                                rs.getString("reference_allele"),
                                rs.getString("tumor_seq_allele2"),
                                rs.getString("variant_classification"),
                                rs.getString("variant_type"),
                                rs.getString("tumor_sample_barcode"),
                                rs.getString("transcript"),
                                rs.getString("exon"),
                                rs.getString("aa_change"),
                                rs.getString("functional_region"),
                                rs.getString("exonic_function")));
                    }
                }
            }

            int totalPages = (int) Math.ceil(totalRows / (double) pageSize);
            boolean first = page <= 1;
            boolean last = totalPages == 0 || page >= totalPages;
            return new PagedResponse<>(content, page, pageSize, totalRows, totalPages, first, last);
        } catch (SQLException e) {
            log.error("[MAF] TCGA IGV gene mutation query failed for gene={}: {}", gene, e.getMessage(), e);
            return new PagedResponse<>(List.of(), page, pageSize, 0, 0, true, true);
        }
    }

    public MafSummaryDto getMafSummary(String source, String gene, String sample, List<String> cancerTypes,
                                       List<String> chromosomes, List<String> variantClasses, List<String> variantTypes) {
        Path mafDb = resolveMafDatabaseFile();
        String table = resolveMafTable(source);
        log.info("[MAF] getMafSummary source={}, db={}, exists={}, table={}",
                source, mafDb.toAbsolutePath(), mafDatabaseAvailable(), table);
        if (!mafDatabaseAvailable()) {
            log.warn("[MAF] Database file not found: {}", mafDb.toAbsolutePath());
            return new MafSummaryDto(source, 0, 0, 0);
        }

        boolean tcga = isTcga(source);

        boolean hasGene = gene != null && !gene.isBlank();
        boolean hasSample = sample != null && !sample.isBlank();
        List<String> normalizedCancerTypes = normalizeFilterValues(cancerTypes);
        List<String> normalizedChromosomes = normalizeChromosomeFilterValues(chromosomes);
        List<String> normalizedVariantClasses = normalizeFilterValues(variantClasses);
        List<String> normalizedVariantTypes = normalizeFilterValues(variantTypes);

        String where = buildMafWhereClause(hasGene, hasSample, normalizedCancerTypes, normalizedChromosomes, normalizedVariantClasses, normalizedVariantTypes, tcga);
        String summarySql =
                "SELECT " +
                        "COUNT(*) AS total_variants, " +
                        "COUNT(DISTINCT NULLIF(tumor_sample_barcode, '')) AS total_samples, " +
                        "COUNT(DISTINCT NULLIF(hugo_symbol, '')) AS total_genes " +
                        "FROM " + table + " " + where;

        try (Connection conn = openMafConnection()) {
            if (!mafTableExists(conn, table)) {
                log.warn("[MAF] Table not found in {}: {}", mafDb.toAbsolutePath(), table);
                return new MafSummaryDto(source, 0, 0, 0);
            }
            try (PreparedStatement stmt = conn.prepareStatement(summarySql)) {
                bindMafParams(stmt, 1, hasGene, gene, hasSample, sample, normalizedCancerTypes, normalizedChromosomes, normalizedVariantClasses, normalizedVariantTypes, tcga);
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        return new MafSummaryDto(
                                source,
                                rs.getLong("total_variants"),
                                rs.getLong("total_samples"),
                                rs.getLong("total_genes")
                        );
                    }
                }
            }
        } catch (SQLException e) {
            log.error("[MAF] SQL summary failed for source={}: {}", source, e.getMessage(), e);
        }

        return new MafSummaryDto(source, 0, 0, 0);
    }

    public List<TopGeneDto> getMafTopGenes(String source, int limit) {
        Path mafDb = resolveMafDatabaseFile();
        String table = resolveMafTable(source);
        if (!mafDatabaseAvailable()) {
            log.warn("[MAF] Database file not found for top genes: {}", mafDb.toAbsolutePath());
            return List.of();
        }

        String sql = "SELECT COALESCE(hugo_symbol, '') AS gene, COUNT(*) AS total_variants " +
                "FROM " + table + " " +
                "WHERE NULLIF(TRIM(COALESCE(hugo_symbol, '')), '') IS NOT NULL " +
                "GROUP BY hugo_symbol " +
                "ORDER BY total_variants DESC, hugo_symbol ASC " +
                "LIMIT ?";

        List<TopGeneDto> results = new ArrayList<>();
        try (Connection conn = openMafConnection()) {
            if (!mafTableExists(conn, table)) {
                log.warn("[MAF] Table not found in {}: {}", mafDb.toAbsolutePath(), table);
                return List.of();
            }
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setInt(1, Math.max(1, limit));
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        results.add(new TopGeneDto(rs.getString("gene"), rs.getLong("total_variants")));
                    }
                }
            }
        } catch (SQLException e) {
            log.error("[MAF] Top gene query failed for source={}: {}", source, e.getMessage(), e);
            return List.of();
        }

        return results;
    }

    /**
     * Returns a gene×sample mutation matrix for the oncoplot (waterfall chart).
     * For each (gene, sample) pair the most severe variant classification is returned.
     * Genes are ordered by the number of distinct samples mutated (descending).
     * Samples are ordered by total mutation count (descending).
     */
    public OncoplottDto getOncoplottData(String source, List<String> cancerTypes, int geneLimit) {
        // Non-TCGA: use clinical_data.txt + mutations_data.txt (richer mutation-type data)
        if (!isTcga(source)) {
            return getOncoplottDataFromPanFiles(cancerTypes, geneLimit);
        }
        // TCGA: keep existing maf.duckdb path
        return getOncoplottDataFromTcga(cancerTypes, geneLimit);
    }

    /**
     * Queries oncoplot data directly from clinical_data.txt + mutations_data.txt via DuckDB.
     * JOINs on Tumor_Sample_Barcode to filter mutations by cancer cohort.
     */
    private OncoplottDto getOncoplottDataFromPanFiles(List<String> cancerTypes, int geneLimit) {
        List<String> requested = normalizeFilterValues(cancerTypes);
        int limit = Math.max(5, Math.min(geneLimit, 50));

        // Map frontend cancer names to CancerType values in clinical_data.txt
        List<String> panTypes = requested.stream()
                .flatMap(c -> CANCER_TO_PAN_CANCER_TYPES.getOrDefault(c, List.of(c)).stream())
                .distinct()
                .toList();

        String cancerFilter = panTypes.isEmpty() ? "" :
                "WHERE c.CancerType IN (" +
                String.join(",", Collections.nCopies(panTypes.size(), "?")) + ")\n";
        String sampleFilter = panTypes.isEmpty()
                ? "WHERE Tumor_Sample_Barcode IS NOT NULL AND TRIM(Tumor_Sample_Barcode) <> ''\n"
                : cancerFilter + "AND Tumor_Sample_Barcode IS NOT NULL AND TRIM(Tumor_Sample_Barcode) <> ''\n";

        String sql =
                "WITH clinical AS (\n" +
                "    SELECT Tumor_Sample_Barcode, CancerType\n" +
                "    FROM pan_cancer_clinical c\n" +
                cancerFilter +
                "),\n" +
                "raw AS (\n" +
                "    SELECT m.Hugo_Symbol, m.Tumor_Sample_Barcode, m.Variant_Classification,\n" +
                "    CASE m.Variant_Classification\n" +
                "        WHEN 'Nonsense_Mutation'       THEN 1\n" +
                "        WHEN 'Frame_Shift_Del'         THEN 2\n" +
                "        WHEN 'Frame_Shift_Ins'         THEN 3\n" +
                "        WHEN 'Splice_Site'             THEN 4\n" +
                "        WHEN 'Nonstop_Mutation'        THEN 4\n" +
                "        WHEN 'Translation_Start_Site'  THEN 4\n" +
                "        WHEN 'In_Frame_Del'            THEN 5\n" +
                "        WHEN 'In_Frame_Ins'            THEN 6\n" +
                "        WHEN 'Missense_Mutation'       THEN 7\n" +
                "        WHEN 'Silent'                  THEN 8\n" +
                "        ELSE 9\n" +
                "    END AS sev\n" +
                "    FROM pan_cancer_mutations m\n" +
                "    JOIN clinical c ON m.Tumor_Sample_Barcode = c.Tumor_Sample_Barcode\n" +
                "),\n" +
                "top_genes AS (\n" +
                "    SELECT Hugo_Symbol FROM (\n" +
                "        SELECT Hugo_Symbol, COUNT(DISTINCT Tumor_Sample_Barcode) AS nsamp\n" +
                "        FROM raw\n" +
                "        WHERE Hugo_Symbol IS NOT NULL AND Hugo_Symbol <> ''\n" +
                "        GROUP BY Hugo_Symbol\n" +
                "        ORDER BY nsamp DESC, Hugo_Symbol ASC\n" +
                "        LIMIT " + limit + "\n" +
                "    )\n" +
                "),\n" +
                "best AS (\n" +
                "    SELECT r.Hugo_Symbol, r.Tumor_Sample_Barcode,\n" +
                "           arg_min(r.Variant_Classification, r.sev) AS variant_class\n" +
                "    FROM raw r\n" +
                "    WHERE r.Hugo_Symbol IN (SELECT Hugo_Symbol FROM top_genes)\n" +
                "    AND r.Tumor_Sample_Barcode IS NOT NULL AND r.Tumor_Sample_Barcode <> ''\n" +
                "    GROUP BY r.Hugo_Symbol, r.Tumor_Sample_Barcode\n" +
                ")\n" +
                "SELECT Hugo_Symbol AS hugo_symbol, Tumor_Sample_Barcode AS tumor_sample_barcode, variant_class\n" +
                "FROM best";

        String sampleSql =
                "SELECT DISTINCT TRIM(Tumor_Sample_Barcode) AS tumor_sample_barcode\n" +
                "FROM pan_cancer_clinical c\n" +
                sampleFilter +
                "ORDER BY tumor_sample_barcode";

        Map<String, Long> geneCounts   = new LinkedHashMap<>();
        Map<String, Long> sampleCounts = new LinkedHashMap<>();
        List<OncoplottDto.CellDto> cells = new ArrayList<>();

        try (Connection conn = openMafConnection();
             PreparedStatement sampleStmt = conn.prepareStatement(sampleSql);
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            int idx = 1;
            for (String t : panTypes) sampleStmt.setString(idx++, t);
            try (ResultSet rs = sampleStmt.executeQuery()) {
                while (rs.next()) {
                    String sample = rs.getString("tumor_sample_barcode");
                    if (sample == null || sample.isBlank()) continue;
                    sampleCounts.put(sample, 0L);
                }
            }

            idx = 1;
            for (String t : panTypes) stmt.setString(idx++, t);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    String gene   = rs.getString("hugo_symbol");
                    String sample = rs.getString("tumor_sample_barcode");
                    String vc     = rs.getString("variant_class");
                    if (gene == null || sample == null || vc == null) continue;
                    cells.add(new OncoplottDto.CellDto(gene, sample, vc));
                    geneCounts.merge(gene, 1L, Long::sum);
                    sampleCounts.merge(sample, 1L, Long::sum);
                }
            }
        } catch (SQLException e) {
            log.error("[MAF] Pan-cancer oncoplot query failed: {}", e.getMessage(), e);
            return new OncoplottDto(List.of(), List.of(), List.of(), Map.of(), Map.of());
        }

        List<String> genes = geneCounts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed()
                        .thenComparing(Map.Entry.comparingByKey()))
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());

        List<String> samples = sampleCounts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed()
                        .thenComparing(Map.Entry.comparingByKey()))
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());

        return new OncoplottDto(genes, samples, cells, geneCounts, sampleCounts);
    }

    /**
     * TCGA oncoplot: uses the tcga_maf table in maf.duckdb, filtered by sample barcodes
     * read from the per-cancer TCGA matrix files (since cancer_type is not populated in DB).
     */
    private OncoplottDto getOncoplottDataFromTcga(List<String> cancerTypes, int geneLimit) {
        if (!mafDatabaseAvailable()) {
            return new OncoplottDto(List.of(), List.of(), List.of(), Map.of(), Map.of());
        }

        String table = TCGA_MAF_TABLE;
        List<String> requested = normalizeFilterValues(cancerTypes);
        int limit = Math.max(5, Math.min(geneLimit, 50));

        String whereFragment;
        List<String> bindValues;
        if (requested.isEmpty()) {
            whereFragment = "";
            bindValues = List.of();
        } else {
            String inClause = "IN (" + String.join(",", Collections.nCopies(requested.size(), "?")) + ")";
            whereFragment =
                    "    WHERE tumor_sample_barcode IN (\n" +
                            "        SELECT sample_id FROM sample_inventory WHERE source = 'tcga' AND cancer_type " + inClause + "\n" +
                            "    )\n";
            bindValues = requested;
        }

        String sql =
                "WITH raw AS (\n" +
                "    SELECT hugo_symbol, tumor_sample_barcode, variant_classification,\n" +
                "    CASE variant_classification\n" +
                "        WHEN 'Nonsense_Mutation'  THEN 1\n" +
                "        WHEN 'Frame_Shift_Del'    THEN 2\n" +
                "        WHEN 'Frame_Shift_Ins'    THEN 3\n" +
                "        WHEN 'Splice_Site'        THEN 4\n" +
                "        WHEN 'In_Frame_Del'       THEN 5\n" +
                "        WHEN 'In_Frame_Ins'       THEN 6\n" +
                "        WHEN 'Missense_Mutation'  THEN 7\n" +
                "        WHEN 'Silent'             THEN 8\n" +
                "        ELSE 9\n" +
                "    END AS sev\n" +
                "    FROM " + table + "\n" +
                whereFragment +
                "),\n" +
                "top_genes AS (\n" +
                "    SELECT hugo_symbol FROM (\n" +
                "        SELECT hugo_symbol, COUNT(DISTINCT tumor_sample_barcode) AS nsamp\n" +
                "        FROM raw\n" +
                "        WHERE hugo_symbol IS NOT NULL AND hugo_symbol <> ''\n" +
                "        GROUP BY hugo_symbol\n" +
                "        ORDER BY nsamp DESC, hugo_symbol ASC\n" +
                "        LIMIT " + limit + "\n" +
                "    )\n" +
                "),\n" +
                "best AS (\n" +
                "    SELECT r.hugo_symbol, r.tumor_sample_barcode,\n" +
                "           arg_min(r.variant_classification, r.sev) AS variant_class\n" +
                "    FROM raw r\n" +
                "    WHERE r.hugo_symbol IN (SELECT hugo_symbol FROM top_genes)\n" +
                "    AND r.tumor_sample_barcode IS NOT NULL AND r.tumor_sample_barcode <> ''\n" +
                "    GROUP BY r.hugo_symbol, r.tumor_sample_barcode\n" +
                ")\n" +
                "SELECT hugo_symbol, tumor_sample_barcode, variant_class FROM best";

        Map<String, Long> geneCounts   = new LinkedHashMap<>();
        Map<String, Long> sampleCounts = new LinkedHashMap<>();
        List<OncoplottDto.CellDto> cells = new ArrayList<>();

        try (Connection conn = openMafConnection()) {
            if (!mafTableExists(conn, table)) {
                return new OncoplottDto(List.of(), List.of(), List.of(), Map.of(), Map.of());
            }
            if (!requested.isEmpty()) {
                try (PreparedStatement sampleStmt = conn.prepareStatement(
                        "SELECT sample_id FROM sample_inventory WHERE source = 'tcga' AND cancer_type IN (" +
                                String.join(",", Collections.nCopies(requested.size(), "?")) +
                                ") ORDER BY sample_id")) {
                    int sampleIdx = 1;
                    for (String value : requested) {
                        sampleStmt.setString(sampleIdx++, value);
                    }
                    try (ResultSet sampleRs = sampleStmt.executeQuery()) {
                        while (sampleRs.next()) {
                            String sampleBarcode = sampleRs.getString("sample_id");
                            if (sampleBarcode != null && !sampleBarcode.isBlank()) {
                                sampleCounts.put(sampleBarcode, 0L);
                            }
                        }
                    }
                }
            }
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                int idx = 1;
                for (String v : bindValues) stmt.setString(idx++, v);
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        String gene   = rs.getString("hugo_symbol");
                        String sample = rs.getString("tumor_sample_barcode");
                        String vc     = rs.getString("variant_class");
                        if (gene == null || sample == null || vc == null) continue;
                        cells.add(new OncoplottDto.CellDto(gene, sample, vc));
                        geneCounts.merge(gene, 1L, Long::sum);
                        sampleCounts.merge(sample, 1L, Long::sum);
                    }
                }
            }
        } catch (SQLException e) {
            log.error("[MAF] TCGA oncoplot query failed: {}", e.getMessage(), e);
            return new OncoplottDto(List.of(), List.of(), List.of(), Map.of(), Map.of());
        }

        List<String> genes = geneCounts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed()
                        .thenComparing(Map.Entry.comparingByKey()))
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());

        List<String> samples = sampleCounts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed()
                        .thenComparing(Map.Entry.comparingByKey()))
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());

        return new OncoplottDto(genes, samples, cells, geneCounts, sampleCounts);
    }



    /**
     * Reads sample barcodes from a TCGA oncoplot matrix file for the given cancer.
     * File path: {dataDir}/{cancer}/stats/oncoplot/oncoplot_matrix_TCGA_{tcgaCode}.txt
     * First row is the header (gene names); first column of subsequent rows is the sample barcode.
     */
    private List<String> readTcgaSampleBarcodes(String cancer) {
        String tcgaCode = CANCER_TO_TCGA_MATRIX.get(cancer);
        if (tcgaCode == null) {
            return List.of();
        }
        Path matrixFile = dataDir.resolve(cancer)
                .resolve("stats").resolve("oncoplot")
                .resolve("oncoplot_matrix_TCGA_" + tcgaCode + ".txt");
        if (!Files.isRegularFile(matrixFile)) {
            log.warn("[MAF] TCGA matrix file not found: {}", matrixFile);
            return List.of();
        }
        try (BufferedReader reader = Files.newBufferedReader(matrixFile, StandardCharsets.UTF_8)) {
            // Skip header row (gene names)
            reader.readLine();
            List<String> barcodes = new ArrayList<>();
            String line;
            while ((line = reader.readLine()) != null) {
                int tab = line.indexOf('\t');
                String barcode = tab > 0 ? line.substring(0, tab).trim() : line.trim();
                if (!barcode.isEmpty()) {
                    barcodes.add(barcode);
                }
            }
            log.debug("[MAF] Read {} TCGA barcodes for cancer={}", barcodes.size(), cancer);
            return barcodes;
        } catch (IOException e) {
            log.error("[MAF] Failed to read TCGA matrix file {}: {}", matrixFile, e.getMessage());
            return List.of();
        }
    }

    public List<String> getMafSuggestions(String source, String columnName, String q, int limit) {
        Path mafDb = resolveMafDatabaseFile();
        String table = resolveMafTable(source);
        if (!mafDatabaseAvailable() || q == null || q.isBlank()) {
            return List.of();
        }

        String normalizedColumn = resolveMafSuggestionColumn(columnName);
        String sql =
                "SELECT DISTINCT " + normalizedColumn + " AS value " +
                        "FROM " + table + " " +
                        "WHERE LOWER(COALESCE(" + normalizedColumn + ", '')) LIKE ? " +
                        "AND NULLIF(TRIM(COALESCE(" + normalizedColumn + ", '')), '') IS NOT NULL " +
                        "ORDER BY value ASC LIMIT ?";

        List<String> values = new ArrayList<>();
        try (Connection conn = openMafConnection()) {
            if (!mafTableExists(conn, table)) {
                log.warn("[MAF] Table not found in {}: {}", mafDb.toAbsolutePath(), table);
                return List.of();
            }
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, "%" + q.trim().toLowerCase(Locale.ROOT) + "%");
                stmt.setInt(2, Math.max(1, Math.min(limit, 20)));
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        values.add(rs.getString("value"));
                    }
                }
            }
        } catch (SQLException e) {
            log.error("[MAF] Suggestions failed for source={}, column={}: {}", source, columnName, e.getMessage(), e);
        }
        return values;
    }

    private String resolveMafSuggestionColumn(String columnName) {
        if ("Tumor_Sample_Barcode".equalsIgnoreCase(columnName)) {
            return "tumor_sample_barcode";
        }
        return "hugo_symbol";
    }

    private MafGeneSummaryDto buildMafGeneSummaryDto(Connection conn,
                                                     String table,
                                                     String geneSymbol,
                                                     long totalVariants,
                                                     long totalSamples,
                                                     long totalCoordinates,
                                                     boolean hasSample,
                                                     String sample,
                                                     List<String> cancerTypes,
                                                     List<String> chromosomes,
                                                     List<String> variantClasses,
                                                     List<String> variantTypes,
                                                     boolean tcga) throws SQLException {
        String coordinateValueExpr =
                "CASE " +
                        "WHEN NULLIF(TRIM(COALESCE(chromosome, '')), '') IS NOT NULL AND NULLIF(TRIM(COALESCE(start_position, '')), '') IS NOT NULL " +
                        "THEN COALESCE(chromosome, '') || ':' || COALESCE(start_position, '') || " +
                        "CASE " +
                        "WHEN NULLIF(TRIM(COALESCE(end_position, '')), '') IS NOT NULL AND COALESCE(end_position, '') <> COALESCE(start_position, '') " +
                        "THEN '-' || COALESCE(end_position, '') " +
                        "ELSE '' END " +
                        "ELSE '' END";
        String alleleValueExpr =
                "CASE " +
                        "WHEN NULLIF(TRIM(COALESCE(reference_allele, '')), '') IS NOT NULL AND NULLIF(TRIM(COALESCE(tumor_seq_allele2, '')), '') IS NOT NULL " +
                        "THEN COALESCE(reference_allele, '') || '>' || COALESCE(tumor_seq_allele2, '') " +
                        "ELSE '' END";
        String cancerPreview = tcga
                ? "-"
                : joinPreview(fetchMafGenePreviewValues(conn, table, geneSymbol, hasSample, sample, cancerTypes, chromosomes, variantClasses, variantTypes, tcga,
                "COALESCE(cancer_type, '')", "COALESCE(cancer_type, '')", "value ASC", 4));
        String samplePreview = joinPreview(fetchMafGenePreviewValues(conn, table, geneSymbol, hasSample, sample, cancerTypes, chromosomes, variantClasses, variantTypes, tcga,
                "COALESCE(tumor_sample_barcode, '')", "COALESCE(tumor_sample_barcode, '')", "value ASC", 4));
        String coordinatePreview = joinPreview(fetchMafGenePreviewValues(conn, table, geneSymbol, hasSample, sample, cancerTypes, chromosomes, variantClasses, variantTypes, tcga,
                coordinateValueExpr, coordinateValueExpr, "value ASC", 4));
        String allelesPreview = joinPreview(fetchMafGenePreviewValues(conn, table, geneSymbol, hasSample, sample, cancerTypes, chromosomes, variantClasses, variantTypes, tcga,
                alleleValueExpr, alleleValueExpr, "value ASC", 4));
        String classesPreview = joinPreview(fetchMafGenePreviewValues(conn, table, geneSymbol, hasSample, sample, cancerTypes, chromosomes, variantClasses, variantTypes, tcga,
                "COALESCE(variant_classification, '')", "COALESCE(variant_classification, '')", "value ASC", 4));
        String typesPreview = joinPreview(fetchMafGenePreviewValues(conn, table, geneSymbol, hasSample, sample, cancerTypes, chromosomes, variantClasses, variantTypes, tcga,
                "COALESCE(variant_type, '')", "COALESCE(variant_type, '')", "value ASC", 4));
        String annotationPreview = tcga
                ? "-"
                : buildMafAnnotationPreview(conn, table, geneSymbol, hasSample, sample, cancerTypes, chromosomes, variantClasses, variantTypes, 4);

        return new MafGeneSummaryDto(
                geneSymbol,
                totalVariants,
                totalSamples,
                totalCoordinates,
                cancerPreview,
                samplePreview,
                coordinatePreview,
                allelesPreview,
                classesPreview,
                typesPreview,
                annotationPreview);
    }

    private List<String> fetchMafGenePreviewValues(Connection conn,
                                                   String table,
                                                   String geneSymbol,
                                                   boolean hasSample,
                                                   String sample,
                                                   List<String> cancerTypes,
                                                   List<String> chromosomes,
                                                   List<String> variantClasses,
                                                   List<String> variantTypes,
                                                   boolean tcga,
                                                   String valueExpression,
                                                   String blankCheckExpression,
                                                   String orderBy,
                                                   int limit) throws SQLException {
        String where = buildMafExactGeneWhereClause(hasSample, cancerTypes, chromosomes, variantClasses, variantTypes, tcga);
        String sql =
                "SELECT DISTINCT " + valueExpression + " AS value " +
                        "FROM " + table + " " +
                        where +
                        "AND NULLIF(TRIM(" + blankCheckExpression + "), '') IS NOT NULL " +
                        "ORDER BY " + orderBy + " " +
                        "LIMIT ?";

        List<String> values = new ArrayList<>();
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            int idx = bindMafExactGeneParams(stmt, 1, geneSymbol, hasSample, sample, cancerTypes, chromosomes, variantClasses, variantTypes, tcga);
            stmt.setInt(idx, Math.max(1, limit));
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    String value = rs.getString("value");
                    if (value != null && !value.isBlank()) {
                        values.add(value);
                    }
                }
            }
        }
        return values;
    }

    private String joinPreview(List<String> values) {
        return values.isEmpty() ? "-" : String.join(", ", values);
    }

    private String buildMafAnnotationPreview(Connection conn,
                                             String table,
                                             String geneSymbol,
                                             boolean hasSample,
                                             String sample,
                                             List<String> cancerTypes,
                                             List<String> chromosomes,
                                             List<String> variantClasses,
                                             List<String> variantTypes,
                                             int limit) throws SQLException {
        String where = buildMafExactGeneWhereClause(hasSample, cancerTypes, chromosomes, variantClasses, variantTypes, false);
        String sql =
                "SELECT DISTINCT " +
                        "COALESCE(functional_region, '') AS fr, " +
                        "COALESCE(exonic_function, '') AS ef, " +
                        "COALESCE(exon, '') AS ex, " +
                        "COALESCE(aa_change, '') AS aa " +
                        "FROM " + table + " " +
                        where +
                        "AND NULLIF(TRIM(COALESCE(functional_region, '') || COALESCE(exonic_function, '') || COALESCE(exon, '') || COALESCE(aa_change, '')), '') IS NOT NULL " +
                        "ORDER BY fr, ef, ex, aa " +
                        "LIMIT ?";

        int fetchLimit = Math.max(limit * 6, 24);
        List<String> entries = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            int idx = bindMafExactGeneParams(stmt, 1, geneSymbol, hasSample, sample, cancerTypes, chromosomes, variantClasses, variantTypes, false);
            stmt.setInt(idx, fetchLimit);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    if (entries.size() >= limit) break;
                    String fr = nullToEmpty(rs.getString("fr")).trim();
                    String ef = nullToEmpty(rs.getString("ef")).trim();
                    String ex = nullToEmpty(rs.getString("ex")).trim();
                    String aa = nullToEmpty(rs.getString("aa")).trim();

                    List<List<String>> aaGroups = splitAaChangeEntries(aa);
                    for (List<String> aaParts : aaGroups) {
                        LinkedHashSet<String> parts = new LinkedHashSet<>();
                        if (!fr.isEmpty()) parts.add(fr);
                        if (!ef.isEmpty()) parts.add(ef);
                        if (!ex.isEmpty()) parts.add(ex);
                        for (String p : aaParts) {
                            if (!p.isEmpty()) parts.add(p);
                        }
                        if (parts.isEmpty()) continue;
                        String joined = String.join(" | ", parts);
                        if (seen.add(joined)) {
                            entries.add(joined);
                            if (entries.size() >= limit) break;
                        }
                    }
                }
            }
        }
        return entries.isEmpty() ? "-" : String.join(", ", entries);
    }

    private List<List<String>> splitAaChangeEntries(String aa) {
        List<List<String>> out = new ArrayList<>();
        if (aa == null || aa.isBlank()) {
            out.add(Collections.emptyList());
            return out;
        }
        for (String chunk : aa.split(",")) {
            String trimmed = chunk.trim();
            if (trimmed.isEmpty()) continue;
            String[] parts = trimmed.split(":");
            int start = (parts.length > 1 && looksLikeGeneSymbol(parts[0])) ? 1 : 0;
            List<String> result = new ArrayList<>();
            for (int i = start; i < parts.length; i++) {
                String p = parts[i].trim();
                if (!p.isEmpty()) result.add(p);
            }
            if (!result.isEmpty()) out.add(result);
        }
        if (out.isEmpty()) out.add(Collections.emptyList());
        return out;
    }

    private boolean looksLikeGeneSymbol(String s) {
        if (s == null || s.isEmpty()) return false;
        String lower = s.toLowerCase(Locale.ROOT);
        if (lower.startsWith("nm_") || lower.startsWith("nr_") || lower.startsWith("xm_") || lower.startsWith("xr_")) return false;
        if (lower.startsWith("exon")) return false;
        if (lower.startsWith("c.") || lower.startsWith("p.") || lower.startsWith("n.") || lower.startsWith("g.")) return false;
        return s.matches("^[A-Za-z][A-Za-z0-9.\\-]*$");
    }

    private String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    private String buildMafWhereClause(boolean hasGene, boolean hasSample, List<String> cancerTypes,
                                       List<String> chromosomes, List<String> variantClasses, List<String> variantTypes,
                                       boolean tcga) {
        List<String> conditions = new ArrayList<>();
        if (hasGene) conditions.add("LOWER(COALESCE(hugo_symbol, '')) LIKE ?");
        if (hasSample) conditions.add("LOWER(COALESCE(tumor_sample_barcode, '')) LIKE ?");
        if (!tcga && !cancerTypes.isEmpty()) conditions.add(buildInClause("cancer_type", cancerTypes.size()));
        if (!chromosomes.isEmpty()) conditions.add(buildInClause(buildNormalizedMafChromosomeExpression(), chromosomes.size()));
        if (!variantClasses.isEmpty()) conditions.add(buildInClause("variant_classification", variantClasses.size()));
        if (!variantTypes.isEmpty()) conditions.add(buildInClause("variant_type", variantTypes.size()));
        return conditions.isEmpty() ? "" : "WHERE " + String.join(" AND ", conditions) + " ";
    }

    private String buildMafExactGeneWhereClause(boolean hasSample, List<String> cancerTypes,
                                                List<String> chromosomes, List<String> variantClasses, List<String> variantTypes,
                                                boolean tcga) {
        List<String> conditions = new ArrayList<>();
        conditions.add("LOWER(COALESCE(hugo_symbol, '')) = ?");
        if (hasSample) conditions.add("LOWER(COALESCE(tumor_sample_barcode, '')) LIKE ?");
        if (!tcga && !cancerTypes.isEmpty()) conditions.add(buildInClause("cancer_type", cancerTypes.size()));
        if (!chromosomes.isEmpty()) conditions.add(buildInClause(buildNormalizedMafChromosomeExpression(), chromosomes.size()));
        if (!variantClasses.isEmpty()) conditions.add(buildInClause("variant_classification", variantClasses.size()));
        if (!variantTypes.isEmpty()) conditions.add(buildInClause("variant_type", variantTypes.size()));
        return "WHERE " + String.join(" AND ", conditions) + " ";
    }

    private int bindMafParams(PreparedStatement stmt, int idx,
                              boolean hasGene, String gene,
                              boolean hasSample, String sample,
                              List<String> cancerTypes,
                              List<String> chromosomes,
                              List<String> variantClasses,
                              List<String> variantTypes,
                              boolean tcga) throws SQLException {
        if (hasGene) stmt.setString(idx++, "%" + gene.trim().toLowerCase(Locale.ROOT) + "%");
        if (hasSample) stmt.setString(idx++, "%" + sample.trim().toLowerCase(Locale.ROOT) + "%");
        if (!tcga) {
            idx = bindListParams(stmt, idx, cancerTypes);
        }
        idx = bindListParams(stmt, idx, chromosomes);
        idx = bindListParams(stmt, idx, variantClasses);
        idx = bindListParams(stmt, idx, variantTypes);
        return idx;
    }

    private List<String> normalizeChromosomeFilterValues(List<String> values) {
        return normalizeFilterValues(values).stream()
                .map(value -> {
                    String normalized = value.toLowerCase(Locale.ROOT);
                    return normalized.startsWith("chr") ? normalized : "chr" + normalized;
                })
                .distinct()
                .toList();
    }

    private String buildNormalizedMafChromosomeExpression() {
        return "CASE " +
                "WHEN NULLIF(TRIM(COALESCE(chromosome, '')), '') IS NOT NULL " +
                "THEN CASE " +
                "  WHEN LOWER(COALESCE(chromosome, '')) LIKE 'chr%' THEN LOWER(COALESCE(chromosome, '')) " +
                "  ELSE 'chr' || LOWER(COALESCE(chromosome, '')) " +
                "END " +
                "ELSE '' END";
    }

    private int bindMafExactGeneParams(PreparedStatement stmt, int idx,
                                       String gene,
                                       boolean hasSample, String sample,
                                       List<String> cancerTypes,
                                       List<String> chromosomes,
                                       List<String> variantClasses,
                                       List<String> variantTypes,
                                       boolean tcga) throws SQLException {
        stmt.setString(idx++, gene.trim().toLowerCase(Locale.ROOT));
        if (hasSample) stmt.setString(idx++, "%" + sample.trim().toLowerCase(Locale.ROOT) + "%");
        if (!tcga) {
            idx = bindListParams(stmt, idx, cancerTypes);
        }
        idx = bindListParams(stmt, idx, chromosomes);
        idx = bindListParams(stmt, idx, variantClasses);
        idx = bindListParams(stmt, idx, variantTypes);
        return idx;
    }

    private int bindListParams(PreparedStatement stmt, int idx, List<String> values) throws SQLException {
        for (String value : values) {
            stmt.setString(idx++, value);
        }
        return idx;
    }

    private String buildInClause(String column, int size) {
        return column + " IN (" + String.join(", ", java.util.Collections.nCopies(size, "?")) + ")";
    }

    private List<String> normalizeFilterValues(List<String> values) {
        if (values == null) {
            return List.of();
        }
        return values.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .distinct()
                .toList();
    }

    private CancerSummaryDto buildCancerSummary(String cancer) {
        String sql =
                "WITH cohort AS (" +
                        "  SELECT " +
                        "    SUM(CASE WHEN category = 'avinput' THEN 1 ELSE 0 END) AS avinput_count, " +
                        "    SUM(CASE WHEN category = 'vcf' THEN 1 ELSE 0 END) AS vcf_count, " +
                        "    SUM(CASE WHEN category = 'multianno' THEN 1 ELSE 0 END) AS multianno_count " +
                        "  FROM cohort_file_index WHERE cancer_type = ? AND source IN ('private', 'public', 'geo')" +
                        "), sample_stats AS (" +
                        "  SELECT COUNT(*) AS sample_count FROM sample_inventory " +
                        "  WHERE cancer_type = ? AND source IN ('private', 'public', 'geo') " +
                        "    AND avinput_file_path IS NOT NULL AND avinput_file_path <> ''" +
                        "), assets AS (" +
                        "  SELECT " +
                        "    SUM(CASE WHEN asset_type = 'cancer_asset' THEN 1 ELSE 0 END) AS plot_asset_count, " +
                        "    SUM(CASE WHEN source IN ('public', 'tcga', 'geo') THEN 1 ELSE 0 END) AS external_asset_count " +
                        "  FROM statistics_asset_index WHERE cancer_type = ?" +
                        ") " +
                        "SELECT sample_count, avinput_count, vcf_count, multianno_count, plot_asset_count, external_asset_count " +
                        "FROM sample_stats, cohort, assets";

        try (Connection connection = openMafConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, cancer);
            statement.setString(2, cancer);
            statement.setString(3, cancer);
            try (ResultSet rs = statement.executeQuery()) {
                if (!rs.next()) {
                    return new CancerSummaryDto(cancer, 0, 0, 0, 0, 0, 0, 0, 0,
                            statusLabel(false), statusLabel(false), statusLabel(false),
                            statusLabel(false), statusLabel(false), statusLabel(false));
                }
                long sampleCount = rs.getLong("sample_count");
                long avinputCount = rs.getLong("avinput_count");
                long filteredVcfCount = rs.getLong("vcf_count");
                long multiannoCount = rs.getLong("multianno_count");
                long plotAssetCount = rs.getLong("plot_asset_count");
                long externalAssetCount = rs.getLong("external_asset_count");
                return new CancerSummaryDto(
                        cancer,
                        sampleCount,
                        avinputCount + filteredVcfCount + multiannoCount,
                        avinputCount,
                        filteredVcfCount,
                        multiannoCount,
                        0,
                        plotAssetCount,
                        externalAssetCount,
                        statusLabel(avinputCount > 0),
                        statusLabel(filteredVcfCount > 0),
                        statusLabel(multiannoCount > 0),
                        statusLabel(false),
                        statusLabel(plotAssetCount > 0),
                        statusLabel(externalAssetCount > 0));
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to build cancer summary for " + cancer, exception);
        }
    }

    private List<CancerAssetDto> discoverAssets(String cancer, String category) {
        Path assetDir = resolveCancerDir(cancer).resolve(category);
        if (!Files.isDirectory(assetDir)) {
            return List.of();
        }

        try (Stream<Path> stream = Files.walk(assetDir)) {
            return stream
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".pdf"))
                    .sorted()
                    .map(path -> {
                        try {
                            long sizeBytes = Files.size(path);
                            String fileName = path.getFileName().toString();
                            String assetUrl = "/api/v1/cancers/assets/" + cancer + "/file/" +
                                    UriUtils.encodePathSegment(fileName, StandardCharsets.UTF_8);
                            return new CancerAssetDto(category, humanizeFileName(fileName), fileName, sizeBytes, assetUrl);
                        } catch (IOException exception) {
                            throw new IllegalStateException("Failed to inspect asset file " + path, exception);
                        }
                    })
                    .toList();
        } catch (IOException exception) {
            log.warn("Failed to scan {} assets for {}", category, cancer, exception);
            return List.of();
        }
    }

    private String validateCancer(String cancer) {
        String normalized = cancer == null ? "" : cancer.trim();
        if (!CANCERS.contains(normalized)) {
            throw new IllegalArgumentException("Unsupported cancer cohort: " + cancer);
        }
        return normalized;
    }

    private Path resolveCancerDir(String cancer) {
        return dataDir.resolve(cancer);
    }

    private Path resolveAggregateMultianno(String cancer) {
        return resolveCancerDir(cancer).resolve(cancer + "_all_sample_multianno.txt");
    }

    /**
     * Splits a potentially comma-separated cancer parameter, validates each,
     * and returns a DuckDB read_csv_auto(...) expression covering all files.
     * Returns null if no valid files exist.
     */
    private String resolveMultiCancerReadExpr(String cancerParam) {
        LinkedHashSet<String> cancers = new LinkedHashSet<>();
        for (String part : cancerParam.split(",")) {
            String value = part == null ? "" : part.trim();
            if (!value.isBlank()) {
                cancers.add(validateCancer(value));
            }
        }
        if (cancers.isEmpty()) {
            return null;
        }
        if (cancers.size() == 1) {
            return "(SELECT * FROM aggregate_multianno WHERE cancer_type = '" + cancers.iterator().next().replace("'", "''") + "')";
        }
        String inClause = cancers.stream()
                .map(value -> "'" + value.replace("'", "''") + "'")
                .collect(Collectors.joining(", "));
        return "(SELECT * FROM aggregate_multianno WHERE cancer_type IN (" + inClause + "))";
    }

    private long countFiles(Path directory, String suffix) {
        if (!Files.isDirectory(directory)) {
            return 0;
        }

        try (Stream<Path> stream = Files.walk(directory)) {
            return stream
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(suffix))
                    .count();
        } catch (IOException exception) {
            log.warn("Failed to scan directory {}", directory, exception);
            return 0;
        }
    }

    private long countAllFiles(Path directory) {
        if (!Files.isDirectory(directory)) {
            return 0;
        }

        try (Stream<Path> stream = Files.walk(directory)) {
            return stream.filter(Files::isRegularFile).count();
        } catch (IOException exception) {
            log.warn("Failed to scan directory {}", directory, exception);
            return 0;
        }
    }

    private boolean hasRequiredColumns(Path filePath, List<String> requiredColumns) {
        try (BufferedReader reader = Files.newBufferedReader(filePath, StandardCharsets.UTF_8)) {
            String headerLine = reader.readLine();
            if (headerLine == null || headerLine.isBlank()) {
                log.warn("Missing header row in aggregate file {}", filePath);
                return false;
            }

            List<String> columns = List.of(headerLine.split("\t", -1));
            boolean valid = requiredColumns.stream().allMatch(columns::contains);
            if (!valid) {
                log.warn("Aggregate file {} is missing one of required columns {}", filePath, requiredColumns);
            }
            return valid;
        } catch (IOException exception) {
            log.warn("Failed to inspect aggregate file {}", filePath, exception);
            return false;
        }
    }

    private String statusLabel(boolean completed) {
        return completed ? "Completed" : "Not started";
    }

    private String humanizeFileName(String fileName) {
        return fileName
                .replace('_', ' ')
                .replace(".pdf", "")
                .trim();
    }

    private String toDuckDbPath(Path path) {
        return path.toString().replace("\\", "/").replace("'", "''");
    }

    // ---- Cohort files: per-source file listing for Browse Files tab ----

    private static final List<String> DATA_SOURCES = List.of("private", "public", "tcga", "geo");

    private static final List<String> FILE_CATEGORIES = List.of("multianno", "vcf");

    public List<CohortFileDto> listCohortFiles(String cancer, String source, String category) {
        String validatedCancer = validateCancer(cancer);
        StringBuilder sql = new StringBuilder(
                "SELECT source, category, file_name, display_name, sample_id, size_bytes " +
                        "FROM cohort_file_index WHERE cancer_type = ?");
        List<String> params = new ArrayList<>();
        params.add(validatedCancer);
        if (source != null && !source.isBlank()) {
            sql.append(" AND source = ?");
            params.add(source);
        }
        if (category != null && !category.isBlank()) {
            sql.append(" AND category = ?");
            params.add(category);
        } else {
            sql.append(" AND category IN ('multianno', 'vcf', 'mutations')");
        }
        sql.append(" ORDER BY source ASC, category ASC, file_name ASC");

        List<CohortFileDto> files = new ArrayList<>();
        try (Connection connection = openMafConnection();
             PreparedStatement statement = connection.prepareStatement(sql.toString())) {
            for (int i = 0; i < params.size(); i++) {
                statement.setString(i + 1, params.get(i));
            }
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    String fileName = rs.getString("file_name");
                    String fileSource = rs.getString("source");
                    String fileCategory = rs.getString("category");
                    files.add(new CohortFileDto(
                            validatedCancer,
                            fileSource,
                            fileCategory,
                            fileName,
                            rs.getString("display_name"),
                            rs.getString("sample_id"),
                            rs.getLong("size_bytes"),
                            "/api/v1/cohort/files/download/" + validatedCancer + "/" + fileSource + "/" + fileCategory + "/" +
                                    UriUtils.encodePathSegment(fileName, StandardCharsets.UTF_8)));
                }
            }
            return files;
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to list cohort files for " + validatedCancer, exception);
        }
    }

    public Resource loadCohortFile(String cancer, String source, String category, String fileName) {
        String validatedCancer = validateCancer(cancer);
        String sql = "SELECT file_path FROM cohort_file_index " +
                "WHERE cancer_type = ? AND source = ? AND category = ? AND file_name = ? LIMIT 1";
        try (Connection connection = openMafConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, validatedCancer);
            statement.setString(2, source);
            statement.setString(3, category);
            statement.setString(4, fileName);
            try (ResultSet rs = statement.executeQuery()) {
                if (!rs.next()) {
                    throw new ResourceNotFoundException("Cohort file not found: " + fileName);
                }
                return new FileSystemResource(Path.of(rs.getString("file_path")));
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load cohort file " + fileName, exception);
        }
    }

    public PagedResponse<SampleBrowseItemDto> listSamples(List<String> cancerFilters,
                                                          List<String> sourceFilters,
                                                          String gene,
                                                          String sample,
                                                          Integer minVariants,
                                                          boolean hasAnnotated,
                                                          boolean hasSomatic,
                                                          boolean includeTopGenes,
                                                          int page,
                                                          int pageSize) {
        List<String> cancers = normalizeCancerFilters(cancerFilters);
        List<String> sources = normalizeSampleSources(sourceFilters);
        String normalizedGene = gene == null ? "" : gene.trim().toLowerCase(Locale.ROOT);
        String normalizedSample = sample == null ? "" : sample.trim().toLowerCase(Locale.ROOT);
        long minVariantCount = minVariants == null ? 0 : Math.max(minVariants, 0);
        int safePage = Math.max(page, 1);

        StringBuilder where = new StringBuilder(" WHERE cancer_type IN (" + String.join(",", Collections.nCopies(cancers.size(), "?")) + ")" +
                " AND source IN (" + String.join(",", Collections.nCopies(sources.size(), "?")) + ")");
        List<Object> params = new ArrayList<>(cancers);
        params.addAll(sources);
        if (!normalizedSample.isBlank()) {
            where.append(" AND LOWER(sample_id) LIKE ?");
            params.add("%" + normalizedSample + "%");
        }
        if (hasAnnotated) {
            where.append(" AND has_annotated = TRUE");
        }
        if (hasSomatic) {
            where.append(" AND has_somatic = TRUE");
        }
        if (minVariantCount > 0) {
            where.append(" AND variant_count >= ?");
            params.add(minVariantCount);
        }
        if (!normalizedGene.isBlank()) {
            where.append(" AND EXISTS (SELECT 1 FROM sample_top_genes stg WHERE stg.cancer_type = sample_inventory.cancer_type " +
                    "AND stg.source = sample_inventory.source AND stg.sample_id = sample_inventory.sample_id AND LOWER(stg.gene_name) = ?)");
            params.add(normalizedGene);
        }

        String countSql = "SELECT COUNT(*) AS total_rows FROM sample_inventory" + where;
        String dataSql = "SELECT cancer_type, source, sample_id, variant_count, has_annotated, has_somatic " +
                "FROM sample_inventory" + where +
                " ORDER BY variant_count DESC, cancer_type ASC, source ASC, sample_id ASC LIMIT ? OFFSET ?";

        try (Connection connection = openMafConnection();
             PreparedStatement countStatement = connection.prepareStatement(countSql);
             PreparedStatement dataStatement = connection.prepareStatement(dataSql)) {
            bindDynamicParams(countStatement, params);
            long total;
            try (ResultSet rs = countStatement.executeQuery()) {
                rs.next();
                total = rs.getLong("total_rows");
            }
            if (total == 0) {
                return new PagedResponse<>(List.of(), safePage, pageSize, 0, 0, true, true);
            }

            bindDynamicParams(dataStatement, params);
            dataStatement.setInt(params.size() + 1, pageSize);
            dataStatement.setInt(params.size() + 2, (safePage - 1) * pageSize);
            List<SampleBrowseItemDto> content = new ArrayList<>();
            try (ResultSet rs = dataStatement.executeQuery()) {
                while (rs.next()) {
                    List<String> topGenes = includeTopGenes
                            ? loadSampleTopGeneNames(connection, rs.getString("cancer_type"), rs.getString("source"), rs.getString("sample_id"), 3)
                            : List.of();
                    List<String> availableFiles = rs.getBoolean("has_annotated") ? List.of("anno") : List.of();
                    content.add(new SampleBrowseItemDto(
                            rs.getString("sample_id"),
                            rs.getString("cancer_type"),
                            rs.getString("source"),
                            rs.getLong("variant_count"),
                            topGenes,
                            availableFiles,
                            rs.getBoolean("has_annotated"),
                            rs.getBoolean("has_somatic")));
                }
            }

            int totalPages = (int) Math.ceil(total / (double) pageSize);
            boolean first = safePage <= 1;
            boolean last = totalPages == 0 || safePage >= totalPages;
            return new PagedResponse<>(content, safePage, pageSize, total, totalPages, first, last);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to list samples", exception);
        }
    }

    public SampleDetailDto getSampleDetail(String cancer, String source, String sampleId) {
        String validatedCancer = validateCancer(cancer);
        String validatedSource = normalizeSingleSampleSource(source);
        String normalizedSampleId = sampleId == null ? "" : sampleId.trim();
        if (normalizedSampleId.isBlank()) {
            throw new IllegalArgumentException("Sample ID is required.");
        }

        String sql = "SELECT variant_count, anno_file_name, anno_file_path FROM sample_inventory " +
                "WHERE cancer_type = ? AND source = ? AND sample_id = ? LIMIT 1";
        try (Connection connection = openMafConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, validatedCancer);
            statement.setString(2, validatedSource);
            statement.setString(3, normalizedSampleId);
            try (ResultSet rs = statement.executeQuery()) {
                if (!rs.next()) {
                    throw new ResourceNotFoundException("Sample not found: " + normalizedSampleId);
                }
                List<LabelCountDto> topGenes = loadSampleTopGenes(connection, validatedCancer, validatedSource, normalizedSampleId, 10);
                List<SampleFileDto> files = new ArrayList<>();
                String annoPath = rs.getString("anno_file_path");
                String annoName = rs.getString("anno_file_name");
                if (annoPath != null && !annoPath.isBlank()) {
                    files.add(buildSampleFileDto(
                            new SampleKey(validatedCancer, validatedSource, normalizedSampleId),
                            "anno",
                            "multianno",
                            Path.of(annoPath)));
                } else if ("tcga".equals(validatedSource)) {
                    files.add(new SampleFileDto("maf", "tcga_maf (database view)", 0, "", ""));
                }
                return new SampleDetailDto(normalizedSampleId, validatedCancer, validatedSource, rs.getLong("variant_count"), topGenes, files);
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load sample detail for " + normalizedSampleId, exception);
        }
    }

    public void writeSampleDownloadZip(SampleDownloadRequestDto request, OutputStream outputStream) throws IOException {
        if (request == null || request.getSamples() == null || request.getSamples().isEmpty()) {
            throw new IllegalArgumentException("At least one sample must be selected.");
        }

        String fileType = normalizeDownloadType(request.getFileType());
        List<SampleSelectionDto> selections = request.getSamples().stream()
                .filter(Objects::nonNull)
                .filter(item -> item.getCancer() != null && item.getSource() != null && item.getSampleId() != null)
                .toList();
        if (selections.isEmpty()) {
            throw new IllegalArgumentException("Selected samples are invalid.");
        }

        List<SampleDownloadItem> downloadItems = new ArrayList<>();
        String sql = "SELECT anno_file_path FROM sample_inventory WHERE cancer_type = ? AND source = ? AND sample_id = ? LIMIT 1";
        try (Connection connection = openMafConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            for (SampleSelectionDto selection : selections) {
                String validatedCancer = validateCancer(selection.getCancer());
                String validatedSource = normalizeSingleSampleSource(selection.getSource());
                String normalizedSampleId = selection.getSampleId().trim();
                statement.setString(1, validatedCancer);
                statement.setString(2, validatedSource);
                statement.setString(3, normalizedSampleId);
                try (ResultSet rs = statement.executeQuery()) {
                    if (rs.next()) {
                        String annoPath = rs.getString("anno_file_path");
                        if (annoPath != null && !annoPath.isBlank()) {
                            downloadItems.add(new SampleDownloadItem(
                                    new SampleKey(validatedCancer, validatedSource, normalizedSampleId),
                                    fileType,
                                    Path.of(annoPath)));
                        }
                    }
                }
            }
        } catch (SQLException exception) {
            throw new IOException("Failed to resolve sample download paths", exception);
        }

        if (downloadItems.isEmpty()) {
            throw new ResourceNotFoundException("No " + fileType + " files are available for the selected samples.");
        }

        byte[] buffer = new byte[8192];
        Set<String> usedEntryNames = new HashSet<>();
        try (ZipOutputStream zipOutputStream = new ZipOutputStream(outputStream, StandardCharsets.UTF_8)) {
            for (SampleDownloadItem item : downloadItems) {
                String entryName = uniqueZipEntryName(
                        item.key.cancer + "/" + item.key.source + "/" + item.key.sampleId + "/" + buildZipFileName(item),
                        usedEntryNames);
                zipOutputStream.putNextEntry(new ZipEntry(entryName));
                if ("maf".equals(item.type)) {
                    writeTcgaSampleMaf(zipOutputStream, item.key.sampleId);
                } else if (item.path != null) {
                    try (InputStream inputStream = Files.newInputStream(item.path)) {
                        int read;
                        while ((read = inputStream.read(buffer)) >= 0) {
                            zipOutputStream.write(buffer, 0, read);
                        }
                    }
                }
                zipOutputStream.closeEntry();
            }
            zipOutputStream.finish();
        }
    }

    public List<LabelCountDto> getSourceDistribution(String cancer) {
        String validatedCancer = validateCancer(cancer);
        String sql = "SELECT source, COUNT(*) AS cnt FROM cohort_file_index " +
                "WHERE cancer_type = ? AND source IN ('private', 'public', 'tcga', 'geo') AND category IN ('multianno', 'vcf') " +
                "GROUP BY source ORDER BY source ASC";
        List<LabelCountDto> results = new ArrayList<>();
        try (Connection connection = openMafConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, validatedCancer);
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    results.add(new LabelCountDto(rs.getString("source"), rs.getLong("cnt")));
                }
            }
            return results;
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load source distribution for " + validatedCancer, exception);
        }
    }

    private SampleBrowseItemDto toSampleBrowseItem(SampleInventory item) {
        return new SampleBrowseItemDto(
                item.key.sampleId,
                item.key.cancer,
                item.key.source,
                item.variantCount,
                item.geneCounts.keySet().stream().limit(3).toList(),
                buildAvailableFileTypes(item),
                item.annoPath != null,
                item.vcfPath != null
        );
    }

    private List<String> buildAvailableFileTypes(SampleInventory item) {
        List<String> available = new ArrayList<>();
        if (item.annoPath != null) {
            available.add("anno");
        }
        return available;
    }

    private List<SampleFileDto> buildSampleDetailFiles(SampleInventory item) {
        List<SampleFileDto> files = new ArrayList<>();
        if (item.annoPath != null) {
            files.add(buildSampleFileDto(item.key, "anno", "multianno", item.annoPath));
        }
        return files;
    }

    private SampleFileDto buildSampleFileDto(SampleKey key, String type, String category, Path path) {
        try {
            long sizeBytes = Files.size(path);
            String lastModified = Files.getLastModifiedTime(path).toInstant().toString();
            String downloadUrl = "vcf".equals(type)
                    ? ""
                    : "/api/v1/cohort/files/download/" +
                    key.cancer + "/" + key.source + "/" + category + "/" +
                    UriUtils.encodePathSegment(path.getFileName().toString(), StandardCharsets.UTF_8);
            return new SampleFileDto(type, path.getFileName().toString(), sizeBytes, lastModified, downloadUrl);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to inspect sample file " + path, exception);
        }
    }

    private LinkedHashMap<SampleKey, SampleInventory> buildSampleInventory(List<String> cancers, List<String> sources) {
        LinkedHashMap<SampleKey, SampleInventory> inventory = new LinkedHashMap<>();
        for (String cancer : cancers) {
            for (String source : sources) {
                if ("tcga".equals(source)) {
                    for (String sampleId : readTcgaSampleBarcodes(cancer)) {
                        if (sampleId == null || sampleId.isBlank()) {
                            continue;
                        }
                        SampleKey key = new SampleKey(cancer, source, sampleId.trim());
                        inventory.computeIfAbsent(key, ignored -> new SampleInventory(key));
                    }
                    continue;
                }

                Path sourceDir = resolveCancerDir(cancer).resolve(source);
                scanSampleFiles(inventory, cancer, source, sourceDir.resolve("multianno"), "multianno");
                for (Path categoryDir : resolveSourceCategoryDirs(sourceDir, "vcf")) {
                    scanSampleFiles(inventory, cancer, source, categoryDir, "vcf");
                }
            }
        }
        return inventory;
    }

    private void scanSampleFiles(Map<SampleKey, SampleInventory> inventory, String cancer, String source, Path directory, String category) {
        if (!Files.isDirectory(directory)) {
            return;
        }
        try (Stream<Path> stream = Files.walk(directory)) {
            stream.filter(Files::isRegularFile)
                    .sorted()
                    .forEach(path -> {
                        String sampleId = extractSampleId(path.getFileName().toString(), category);
                        if (sampleId == null || sampleId.isBlank()) {
                            return;
                        }
                        SampleKey key = new SampleKey(cancer, source, sampleId.trim());
                        SampleInventory item = inventory.computeIfAbsent(key, ignored -> new SampleInventory(key));
                        if ("multianno".equals(category)) {
                            item.annoPath = path;
                        } else if ("vcf".equals(category)) {
                            item.vcfPath = path;
                        }
                    });
        } catch (IOException exception) {
            log.warn("Failed to scan sample files for {}/{}/{}", cancer, source, category, exception);
        }
    }

    private void enrichPrivatePublicSamples(Map<SampleKey, SampleInventory> inventory, boolean includeTopGenes) {
        Map<String, SampleInventory> byFileName = new HashMap<>();
        List<Path> files = inventory.values().stream()
                .filter(item -> !"tcga".equals(item.key.source))
                .map(item -> item.annoPath)
                .filter(Objects::nonNull)
                .map(Path::toAbsolutePath)
                .distinct()
                .toList();
        if (files.isEmpty()) {
            return;
        }

        for (SampleInventory item : inventory.values()) {
            if (item.annoPath != null) {
                byFileName.put(toDuckDbPath(item.annoPath.toAbsolutePath()), item);
            }
        }

        String readExpr = buildReadCsvExpr(files, true);
        String countSql = "SELECT filename, COUNT(*) AS variant_count FROM " + readExpr + " GROUP BY filename";
        try (Connection connection = DriverManager.getConnection("jdbc:duckdb:");
             Statement statement = connection.createStatement()) {
            try (ResultSet resultSet = statement.executeQuery(countSql)) {
                while (resultSet.next()) {
                    SampleInventory item = byFileName.get(resultSet.getString("filename"));
                    if (item != null) {
                        item.variantCount = resultSet.getLong("variant_count");
                    }
                }
            }
            if (includeTopGenes) {
                String topGeneSql =
                        "WITH split_genes AS (" +
                                "  SELECT filename, TRIM(gene_name) AS gene_name FROM (" +
                                "    SELECT filename, UNNEST(STRING_SPLIT(COALESCE(\"Gene.refGene\", ''), ';')) AS gene_name FROM " + readExpr +
                                "  ) raw WHERE TRIM(gene_name) <> '' AND TRIM(gene_name) <> '.'" +
                                "), counts AS (" +
                                "  SELECT filename, gene_name, COUNT(*) AS gene_count FROM split_genes GROUP BY filename, gene_name" +
                                "), ranked AS (" +
                                "  SELECT filename, gene_name, gene_count, ROW_NUMBER() OVER (PARTITION BY filename ORDER BY gene_count DESC, gene_name ASC) AS rn FROM counts" +
                                ") " +
                                "SELECT filename, gene_name, gene_count FROM ranked WHERE rn <= 10 ORDER BY filename ASC, rn ASC";
                try (ResultSet resultSet = statement.executeQuery(topGeneSql)) {
                    while (resultSet.next()) {
                        SampleInventory item = byFileName.get(resultSet.getString("filename"));
                        if (item != null) {
                            item.geneCounts.put(resultSet.getString("gene_name"), resultSet.getLong("gene_count"));
                        }
                    }
                }
            }
        } catch (SQLException exception) {
            log.warn("Failed to enrich private/public sample summaries", exception);
        }
    }

    private void enrichTcgaSamples(Map<SampleKey, SampleInventory> inventory, boolean includeTopGenes) {
        List<SampleInventory> tcgaSamples = inventory.values().stream()
                .filter(item -> "tcga".equals(item.key.source))
                .toList();
        if (tcgaSamples.isEmpty() || !mafDatabaseAvailable()) {
            return;
        }

        List<String> sampleIds = tcgaSamples.stream()
                .map(item -> item.key.sampleId)
                .distinct()
                .toList();
        String placeholders = String.join(", ", Collections.nCopies(sampleIds.size(), "?"));
        String countSql = "SELECT tumor_sample_barcode AS sample_id, COUNT(*) AS variant_count " +
                "FROM " + TCGA_MAF_TABLE + " WHERE tumor_sample_barcode IN (" + placeholders + ") " +
                "GROUP BY tumor_sample_barcode";
        try (Connection connection = openMafConnection()) {
            if (!mafTableExists(connection, TCGA_MAF_TABLE)) {
                return;
            }
            try (PreparedStatement statement = connection.prepareStatement(countSql)) {
                bindValues(statement, sampleIds, 1);
                try (ResultSet resultSet = statement.executeQuery()) {
                    while (resultSet.next()) {
                        String sampleId = resultSet.getString("sample_id");
                        long variantCount = resultSet.getLong("variant_count");
                        tcgaSamples.stream()
                                .filter(item -> item.key.sampleId.equals(sampleId))
                                .forEach(item -> item.variantCount = variantCount);
                    }
                }
            }
            if (includeTopGenes) {
                String topGeneSql =
                        "WITH counts AS (" +
                                "  SELECT tumor_sample_barcode AS sample_id, COALESCE(hugo_symbol, '') AS gene_name, COUNT(*) AS gene_count " +
                                "  FROM " + TCGA_MAF_TABLE +
                                "  WHERE tumor_sample_barcode IN (" + placeholders + ") AND COALESCE(hugo_symbol, '') <> '' " +
                                "  GROUP BY tumor_sample_barcode, COALESCE(hugo_symbol, '')" +
                                "), ranked AS (" +
                                "  SELECT sample_id, gene_name, gene_count, ROW_NUMBER() OVER (PARTITION BY sample_id ORDER BY gene_count DESC, gene_name ASC) AS rn FROM counts" +
                                ") " +
                                "SELECT sample_id, gene_name, gene_count FROM ranked WHERE rn <= 10 ORDER BY sample_id ASC, rn ASC";
                try (PreparedStatement statement = connection.prepareStatement(topGeneSql)) {
                    bindValues(statement, sampleIds, 1);
                    try (ResultSet resultSet = statement.executeQuery()) {
                        while (resultSet.next()) {
                            String sampleId = resultSet.getString("sample_id");
                            String geneName = resultSet.getString("gene_name");
                            long geneCount = resultSet.getLong("gene_count");
                            tcgaSamples.stream()
                                    .filter(item -> item.key.sampleId.equals(sampleId))
                                    .forEach(item -> item.geneCounts.put(geneName, geneCount));
                        }
                    }
                }
            }
        } catch (SQLException exception) {
            log.warn("Failed to enrich TCGA sample summaries", exception);
        }
    }

    private void bindValues(PreparedStatement statement, List<String> values, int startIndex) throws SQLException {
        for (int index = 0; index < values.size(); index++) {
            statement.setString(startIndex + index, values.get(index));
        }
    }

    private void bindDynamicParams(PreparedStatement statement, List<Object> values) throws SQLException {
        for (int index = 0; index < values.size(); index++) {
            statement.setObject(index + 1, values.get(index));
        }
    }

    private List<String> loadSampleTopGeneNames(Connection connection, String cancer, String source, String sampleId, int limit) throws SQLException {
        String sql = "SELECT gene_name FROM sample_top_genes " +
                "WHERE cancer_type = ? AND source = ? AND sample_id = ? ORDER BY rank_no ASC LIMIT ?";
        List<String> genes = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, cancer);
            statement.setString(2, source);
            statement.setString(3, sampleId);
            statement.setInt(4, limit);
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    genes.add(rs.getString("gene_name"));
                }
            }
        }
        return genes;
    }

    private List<LabelCountDto> loadSampleTopGenes(Connection connection, String cancer, String source, String sampleId, int limit) throws SQLException {
        String sql = "SELECT gene_name, gene_count FROM sample_top_genes " +
                "WHERE cancer_type = ? AND source = ? AND sample_id = ? ORDER BY rank_no ASC LIMIT ?";
        List<LabelCountDto> genes = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, cancer);
            statement.setString(2, source);
            statement.setString(3, sampleId);
            statement.setInt(4, limit);
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    genes.add(new LabelCountDto(rs.getString("gene_name"), rs.getLong("gene_count")));
                }
            }
        }
        return genes;
    }

    private String buildReadCsvExpr(List<Path> paths, boolean includeFileName) {
        List<String> normalizedPaths = paths.stream()
                .map(Path::toAbsolutePath)
                .map(this::toDuckDbPath)
                .toList();
        String options = "delim='\\t', header=true, ignore_errors=true, union_by_name=true" +
                (includeFileName ? ", filename=true" : "");
        if (normalizedPaths.size() == 1) {
            return "read_csv_auto('" + normalizedPaths.get(0) + "', " + options + ")";
        }
        String fileList = normalizedPaths.stream()
                .map(path -> "'" + path + "'")
                .collect(Collectors.joining(", "));
        return "read_csv_auto([" + fileList + "], " + options + ")";
    }

    private List<Path> resolveSourceCategoryDirs(Path sourceDir, String category) {
        if ("vcf".equals(category)) {
            return List.of(sourceDir.resolve("vcf"), sourceDir.resolve("filtered_vcf"));
        }
        return List.of(sourceDir.resolve(category));
    }

    private List<String> normalizeCancerFilters(List<String> filters) {
        if (filters == null || filters.isEmpty()) {
            return CANCERS;
        }
        LinkedHashSet<String> values = new LinkedHashSet<>();
        for (String filter : filters) {
            if (filter == null || filter.isBlank()) {
                continue;
            }
            Arrays.stream(filter.split(","))
                    .map(String::trim)
                    .filter(value -> !value.isBlank())
                    .forEach(value -> values.add(validateCancer(value)));
        }
        return values.isEmpty() ? CANCERS : List.copyOf(values);
    }

    private List<String> normalizeSampleSources(List<String> filters) {
        if (filters == null || filters.isEmpty()) {
            return DATA_SOURCES;
        }
        LinkedHashSet<String> values = new LinkedHashSet<>();
        for (String filter : filters) {
            if (filter == null || filter.isBlank()) {
                continue;
            }
            Arrays.stream(filter.split(","))
                    .map(String::trim)
                    .filter(value -> !value.isBlank())
                    .map(this::normalizeSingleSampleSource)
                    .forEach(values::add);
        }
        return values.isEmpty() ? DATA_SOURCES : List.copyOf(values);
    }

    private String normalizeSingleSampleSource(String source) {
        String normalized = source == null ? "" : source.trim().toLowerCase(Locale.ROOT);
        if (!DATA_SOURCES.contains(normalized)) {
            throw new IllegalArgumentException("Unsupported sample source: " + source);
        }
        return normalized;
    }

    private String normalizeDownloadType(String fileType) {
        String normalized = fileType == null ? "" : fileType.trim().toLowerCase(Locale.ROOT);
        if (!List.of("anno").contains(normalized)) {
            throw new IllegalArgumentException("Unsupported sample download type: " + fileType);
        }
        return normalized;
    }

    private String buildZipFileName(SampleDownloadItem item) {
        if ("maf".equals(item.type)) {
            return item.key.sampleId + ".maf.tsv";
        }
        return item.path == null ? item.key.sampleId + "." + item.type : item.path.getFileName().toString();
    }

    private String uniqueZipEntryName(String candidate, Set<String> usedNames) {
        if (usedNames.add(candidate)) {
            return candidate;
        }
        int dot = candidate.lastIndexOf('.');
        String base = dot >= 0 ? candidate.substring(0, dot) : candidate;
        String ext = dot >= 0 ? candidate.substring(dot) : "";
        int index = 2;
        while (!usedNames.add(base + "_" + index + ext)) {
            index++;
        }
        return base + "_" + index + ext;
    }

    private void writeTcgaSampleMaf(ZipOutputStream zipOutputStream, String sampleId) throws IOException {
        if (!mafDatabaseAvailable()) {
            return;
        }
        String sql =
                "SELECT " +
                        "COALESCE(hugo_symbol, '') AS hugo_symbol, " +
                        "COALESCE(chromosome, '') AS chromosome, " +
                        "COALESCE(start_position, '') AS start_position, " +
                        "COALESCE(end_position, '') AS end_position, " +
                        "COALESCE(reference_allele, '') AS reference_allele, " +
                        "COALESCE(tumor_seq_allele2, '') AS tumor_seq_allele2, " +
                        "COALESCE(variant_classification, '') AS variant_classification, " +
                        "COALESCE(variant_type, '') AS variant_type, " +
                        "COALESCE(transcript, '') AS transcript, " +
                        "COALESCE(exon, '') AS exon, " +
                        "COALESCE(aa_change, '') AS aa_change " +
                        "FROM " + TCGA_MAF_TABLE + " WHERE tumor_sample_barcode = ? " +
                        "ORDER BY chromosome ASC, TRY_CAST(start_position AS BIGINT) ASC NULLS LAST, hugo_symbol ASC";

        String header = "Hugo_Symbol\tChromosome\tStart_Position\tEnd_Position\tReference_Allele\tTumor_Seq_Allele2\tVariant_Classification\tVariant_Type\tTranscript\tExon\tAA_Change\n";
        zipOutputStream.write(header.getBytes(StandardCharsets.UTF_8));
        try (Connection connection = openMafConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            if (!mafTableExists(connection, TCGA_MAF_TABLE)) {
                return;
            }
            statement.setString(1, sampleId);
            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    String line = String.join("\t",
                            resultSet.getString("hugo_symbol"),
                            resultSet.getString("chromosome"),
                            resultSet.getString("start_position"),
                            resultSet.getString("end_position"),
                            resultSet.getString("reference_allele"),
                            resultSet.getString("tumor_seq_allele2"),
                            resultSet.getString("variant_classification"),
                            resultSet.getString("variant_type"),
                            resultSet.getString("transcript"),
                            resultSet.getString("exon"),
                            resultSet.getString("aa_change")) + "\n";
                    zipOutputStream.write(line.getBytes(StandardCharsets.UTF_8));
                }
            }
        } catch (SQLException exception) {
            throw new IOException("Failed to stream TCGA MAF for sample " + sampleId, exception);
        }
    }

    private String extractSampleId(String fileName, String category) {
        if ("multianno".equals(category)) {
            // e.g. "BR_RTCG0P0003-1-TWN1.hg38_multianno.txt" → "BR_RTCG0P0003-1-TWN1"
            int idx = fileName.indexOf(".hg38_multianno");
            if (idx > 0) return fileName.substring(0, idx);
            idx = fileName.indexOf("_multianno");
            if (idx > 0) return fileName.substring(0, idx);
        } else if ("filtered_vcf".equals(category) || "vcf".equals(category)) {
            // e.g. "BR_RTCG0P0003-1-TWN1.filtered.vcf.gz" → "BR_RTCG0P0003-1-TWN1"
            int idx = fileName.indexOf(".filtered");
            if (idx > 0) return fileName.substring(0, idx);
            idx = fileName.indexOf(".vcf");
            if (idx > 0) return fileName.substring(0, idx);
        }
        // fallback: strip extension
        int dot = fileName.indexOf('.');
        return dot > 0 ? fileName.substring(0, dot) : fileName;
    }

    private static final class SampleKey {
        private final String cancer;
        private final String source;
        private final String sampleId;

        private SampleKey(String cancer, String source, String sampleId) {
            this.cancer = cancer;
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
            return Objects.equals(cancer, that.cancer)
                    && Objects.equals(source, that.source)
                    && Objects.equals(sampleId, that.sampleId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(cancer, source, sampleId);
        }
    }

    private static final class SampleInventory {
        private final SampleKey key;
        private Path annoPath;
        private Path vcfPath;
        private long variantCount;
        private final LinkedHashMap<String, Long> geneCounts = new LinkedHashMap<>();

        private SampleInventory(SampleKey key) {
            this.key = key;
        }

        private boolean hasGene(String gene) {
            return geneCounts.keySet().stream().anyMatch(value -> value.equalsIgnoreCase(gene));
        }
    }

    private static final class SampleDownloadItem {
        private final SampleKey key;
        private final String type;
        private final Path path;

        private SampleDownloadItem(SampleKey key, String type, Path path) {
            this.key = key;
            this.type = type;
            this.path = path;
        }
    }

    // ---- Statistics page: data-source-aware plot discovery ----

    /**
     * Resolve the plot directory for a given cancer + source.
     * private   → {cancer}/private/stats/
     * public    → {cancer}/public/stats/
     * tcga      → {cancer}/tcga/stats/
     * Overview  → {cancer}/stats/
     */
    private Path resolveStatisticsPlotDir(String cancer, String source) {
        Path cancerDir = resolveCancerDir(cancer);
        switch (source) {
            case "private":  return cancerDir.resolve("private").resolve("stats");
            case "public":   return cancerDir.resolve("public").resolve("stats");
            case "tcga":     return cancerDir.resolve("tcga").resolve("stats");
            case "geo":      return cancerDir.resolve("geo").resolve("stats");
            case "Overview": return cancerDir.resolve("stats");
            default: throw new IllegalArgumentException("Unknown data source: " + source);
        }
    }

    /** List data sources that have at least one PDF plot for a cancer. */
    public List<String> getStatisticsSources(String cancer) {
        String validated = validateCancer(cancer);
        String sql = "SELECT DISTINCT source FROM statistics_asset_index " +
                "WHERE cancer_type = ? AND asset_type = 'statistics_plot' ORDER BY source ASC";
        List<String> sources = new ArrayList<>();
        try (Connection connection = openMafConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, validated);
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    sources.add(rs.getString("source"));
                }
            }
            return sources;
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to list statistics sources for " + validated, exception);
        }
    }

    private boolean hasDirectPdfFiles(Path dir) {
        try (Stream<Path> stream = Files.list(dir)) {
            return stream.anyMatch(p -> Files.isRegularFile(p) &&
                    p.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".pdf"));
        } catch (IOException e) {
            return false;
        }
    }

    /** List PDF plots (not in gene subfolders) for a cancer + source. */
    public List<CancerAssetDto> getStatisticsPlots(String cancer, String source) {
        String validated = validateCancer(cancer);
        String sql = "SELECT title, file_name, size_bytes FROM statistics_asset_index " +
                "WHERE cancer_type = ? AND source = ? AND asset_type = 'statistics_plot' ORDER BY file_name ASC";
        List<CancerAssetDto> plots = new ArrayList<>();
        try (Connection connection = openMafConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, validated);
            statement.setString(2, source);
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    String fileName = rs.getString("file_name");
                    plots.add(new CancerAssetDto(
                            source,
                            rs.getString("title"),
                            fileName,
                            rs.getLong("size_bytes"),
                            "/api/v1/statistics/" + validated + "/plots/file?source=" +
                                    UriUtils.encodeQueryParam(source, StandardCharsets.UTF_8) + "&fileName=" +
                                    UriUtils.encodeQueryParam(fileName, StandardCharsets.UTF_8)));
                }
            }
            return plots;
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to list statistics plots for " + validated + "/" + source, exception);
        }
    }

    /** Serve a specific statistics plot PDF file. */
    public CancerAssetResource loadStatisticsPlot(String cancer, String source, String fileName) {
        String validated = validateCancer(cancer);
        String sql = "SELECT file_path, size_bytes FROM statistics_asset_index " +
                "WHERE cancer_type = ? AND source = ? AND asset_type = 'statistics_plot' AND file_name = ? LIMIT 1";
        try (Connection connection = openMafConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, validated);
            statement.setString(2, source);
            statement.setString(3, fileName);
            try (ResultSet rs = statement.executeQuery()) {
                if (!rs.next()) {
                    throw new ResourceNotFoundException("Plot not found: " + source + "/" + fileName);
                }
                return new CancerAssetResource(new FileSystemResource(Path.of(rs.getString("file_path"))),
                        fileName, "application/pdf", rs.getLong("size_bytes"));
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to read statistics plot " + fileName, exception);
        }
    }

    /** Find the gene lollipop plot subfolder within a plot directory. */
    private Path findGenePlotFolder(String cancer, String source) {
        Path lollipopDir = resolveStatisticsPlotDir(cancer, source).resolve("lollipop");
        if (!Files.isDirectory(lollipopDir)) return null;
        try (Stream<Path> stream = Files.list(lollipopDir)) {
            boolean hasLollipop = stream.anyMatch(f ->
                    Files.isRegularFile(f) && f.getFileName().toString().startsWith("lollipop_")
                            && f.getFileName().toString().endsWith(".pdf"));
            return hasLollipop ? lollipopDir : null;
        } catch (IOException e) {
            return null;
        }
    }

    /** List gene names available as lollipop plots, filtered by query prefix. */
    public List<String> getGenePlotNames(String cancer, String source, String query) {
        String validated = validateCancer(cancer);
        String q = (query == null) ? "" : query.trim().toLowerCase(Locale.ROOT);
        String sql = "SELECT DISTINCT gene_name FROM statistics_asset_index " +
                "WHERE cancer_type = ? AND source = ? AND asset_type = 'gene_plot' " +
                "AND COALESCE(gene_name, '') <> '' AND LOWER(gene_name) LIKE ? " +
                "ORDER BY gene_name ASC LIMIT 50";
        List<String> genes = new ArrayList<>();
        try (Connection connection = openMafConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, validated);
            statement.setString(2, source);
            statement.setString(3, q.isEmpty() ? "%" : q + "%");
            try (ResultSet rs = statement.executeQuery()) {
                while (rs.next()) {
                    genes.add(rs.getString("gene_name"));
                }
            }
            return genes;
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to list gene plots for " + validated + "/" + source, exception);
        }
    }

    /** Check if gene lollipop plots are available for a cancer + source. */
    public boolean hasGenePlots(String cancer, String source) {
        String validated = validateCancer(cancer);
        String sql = "SELECT COUNT(*) FROM statistics_asset_index WHERE cancer_type = ? AND source = ? AND asset_type = 'gene_plot'";
        try (Connection connection = openMafConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, validated);
            statement.setString(2, source);
            try (ResultSet rs = statement.executeQuery()) {
                rs.next();
                return rs.getLong(1) > 0;
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to check gene plots for " + validated + "/" + source, exception);
        }
    }

    /** Serve a specific gene lollipop plot PDF. */
    public CancerAssetResource loadGenePlot(String cancer, String source, String gene) {
        String validated = validateCancer(cancer);
        String sql = "SELECT file_name, file_path, size_bytes FROM statistics_asset_index " +
                "WHERE cancer_type = ? AND source = ? AND asset_type = 'gene_plot' AND gene_name = ? LIMIT 1";
        try (Connection connection = openMafConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, validated);
            statement.setString(2, source);
            statement.setString(3, gene);
            try (ResultSet rs = statement.executeQuery()) {
                if (!rs.next()) {
                    throw new ResourceNotFoundException("Gene plot not found: " + gene);
                }
                return new CancerAssetResource(new FileSystemResource(Path.of(rs.getString("file_path"))),
                        rs.getString("file_name"), "application/pdf", rs.getLong("size_bytes"));
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to read gene plot " + gene, exception);
        }
    }

    public static final class CancerAssetResource {
        private final Resource resource;
        private final String fileName;
        private final String contentType;
        private final long fileSizeBytes;

        public CancerAssetResource(Resource resource, String fileName, String contentType, long fileSizeBytes) {
            this.resource = resource;
            this.fileName = fileName;
            this.contentType = contentType;
            this.fileSizeBytes = fileSizeBytes;
        }

        public Resource resource() { return resource; }
        public String fileName() { return fileName; }
        public String contentType() { return contentType; }
        public long fileSizeBytes() { return fileSizeBytes; }

        public Resource getResource() { return resource; }
        public String getFileName() { return fileName; }
        public String getContentType() { return contentType; }
        public long getFileSizeBytes() { return fileSizeBytes; }
    }

    // ---- VAF Distribution (ridgeline plot data) ----

    /**
     * Reads all *_VAF_statistics.txt files from the vafDataDir and returns
     * per-cancer-type lists of Average VAF values. Excludes GEO_ and Experiment_ prefixed files.
     */
    public List<VafDistributionDto> getVafDistribution() {
        List<VafDistributionDto> result = new ArrayList<>();
        if (!Files.isDirectory(vafDataDir)) {
            log.warn("[VAF] vafDataDir does not exist: {}", vafDataDir);
            return result;
        }
        try (Stream<Path> files = Files.list(vafDataDir)) {
            List<Path> vafFiles = files
                    .filter(p -> p.getFileName().toString().endsWith("_VAF_statistics.txt"))
                    .filter(p -> {
                        String name = p.getFileName().toString();
                        return !name.startsWith("GEO_") && !name.startsWith("Experiment_");
                    })
                    .sorted()
                    .collect(Collectors.toList());

            for (Path vafFile : vafFiles) {
                String fileName = vafFile.getFileName().toString();
                String cancerType = fileName.replace("_VAF_statistics.txt", "");
                List<Double> values = readVafValues(vafFile);
                if (!values.isEmpty()) {
                    result.add(new VafDistributionDto(cancerType, values));
                }
            }
        } catch (IOException e) {
            log.error("[VAF] Failed to list vafDataDir: {}", vafDataDir, e);
        }
        // Sort by median VAF descending
        result.sort((a, b) -> {
            double medA = median(a.getValues());
            double medB = median(b.getValues());
            return Double.compare(medB, medA);
        });
        return result;
    }

    private List<Double> readVafValues(Path file) {
        List<Double> values = new ArrayList<>();
        try (BufferedReader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            String header = reader.readLine(); // skip header
            if (header == null) return values;
            String line;
            while ((line = reader.readLine()) != null) {
                String[] parts = line.split("\t");
                if (parts.length >= 3) {
                    try {
                        double avgVaf = Double.parseDouble(parts[2]);
                        values.add(avgVaf);
                    } catch (NumberFormatException e) {
                        // skip malformed lines
                    }
                }
            }
        } catch (IOException e) {
            log.warn("[VAF] Failed to read file: {}", file, e);
        }
        return values;
    }

    private static double median(List<Double> vals) {
        if (vals.isEmpty()) return 0;
        List<Double> sorted = new ArrayList<>(vals);
        Collections.sort(sorted);
        int mid = sorted.size() / 2;
        return sorted.size() % 2 == 0
                ? (sorted.get(mid - 1) + sorted.get(mid)) / 2.0
                : sorted.get(mid);
    }
}
