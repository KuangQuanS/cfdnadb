package org.cfdna.database.service;

import org.cfdna.database.dto.CancerAssetDto;
import org.cfdna.database.dto.CancerSummaryDto;
import org.cfdna.database.dto.DataFileDto;
import org.cfdna.database.dto.DatabaseStatsDto;
import org.cfdna.database.dto.GeneSummaryDto;
import org.cfdna.database.dto.GeneVariantDto;
import org.cfdna.database.dto.LabelCountDto;
import org.cfdna.database.dto.MafFilterOptionsDto;
import org.cfdna.database.dto.MafGeneSummaryDto;
import org.cfdna.database.dto.MafMutationDto;
import org.cfdna.database.dto.MafSummaryDto;
import org.cfdna.database.dto.PagedResponse;
import org.cfdna.database.dto.TopGeneDto;
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
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.stream.Stream;

@Service
public class DuckDbService {

    private static final Logger log = LoggerFactory.getLogger(DuckDbService.class);
    private static final Path DEFAULT_DATA_DIR = Path.of("/400T/cfdnadb");
    private static final List<String> CANCERS = List.of("Breast", "Colonrector", "Liver", "Lung", "Pdac");
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
    private final String mafDbFileName;

    @Autowired
    public DuckDbService(@Value("${app.data-dir:/400T/cfdnadb}") String dataDir,
                         @Value("${app.maf-db-file:maf.duckdb}") String mafDbFileName) {
        this(Path.of(dataDir), mafDbFileName);
    }

    public DuckDbService(Path dataDir) {
        this(dataDir, "maf.duckdb");
    }

    public DuckDbService(Path dataDir, String mafDbFileName) {
        this.dataDir = dataDir;
        this.mafDbFileName = mafDbFileName;
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
        Path aggregateMultianno = resolveAggregateMultianno(validateCancer(cancer));
        if (!Files.isRegularFile(aggregateMultianno) || !hasRequiredColumns(aggregateMultianno, List.of("Gene.refGene"))) {
            return List.of();
        }

        String sql = "SELECT TRIM(gene_name) AS gene, COUNT(*) AS occurrence_count " +
                "FROM (" +
                "  SELECT UNNEST(STRING_SPLIT(COALESCE(\"Gene.refGene\", ''), ';')) AS gene_name " +
                "  FROM read_csv_auto('%s', delim='\\t', header=true, ignore_errors=true)" +
                ") split_genes " +
                "WHERE TRIM(gene_name) <> '' AND TRIM(gene_name) <> '.' " +
                "GROUP BY gene " +
                "ORDER BY occurrence_count DESC, gene ASC " +
                "LIMIT %d";

        List<TopGeneDto> results = new ArrayList<>();
        try (Connection connection = DriverManager.getConnection("jdbc:duckdb:");
             Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(sql.formatted(toDuckDbPath(aggregateMultianno), limit))) {
            while (resultSet.next()) {
                results.add(new TopGeneDto(resultSet.getString("gene"), resultSet.getLong("occurrence_count")));
            }
            return results;
        } catch (SQLException exception) {
            log.warn("Failed to query top genes for {} from {}", cancer, aggregateMultianno, exception);
            return List.of();
        }
    }

    public PagedResponse<GeneVariantDto> getVariantsByGene(String cancer, String gene, int page, int pageSize) {
        Path aggregateMultianno = resolveAggregateMultianno(validateCancer(cancer));
        if (!Files.isRegularFile(aggregateMultianno) || !hasRequiredColumns(aggregateMultianno, REQUIRED_MULTIANNO_COLUMNS)) {
            return new PagedResponse<>(List.of(), page, pageSize, 0, 0, true, true);
        }

        String normalizedGene = gene.trim().toLowerCase(Locale.ROOT);
        String countSql = "SELECT COUNT(*) AS total_rows " +
                "FROM read_csv_auto('%s', delim='\\t', header=true, ignore_errors=true) " +
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
                "FROM read_csv_auto('%s', delim='\\t', header=true, ignore_errors=true) " +
                "WHERE POSITION(? IN LOWER(COALESCE(\"Gene.refGene\", ''))) > 0 " +
                "ORDER BY start_pos ASC, sample_barcode ASC " +
                "LIMIT ? OFFSET ?";

        long totalRows;
        try (Connection connection = DriverManager.getConnection("jdbc:duckdb:");
             PreparedStatement countStatement = connection.prepareStatement(countSql.formatted(toDuckDbPath(aggregateMultianno)))) {
            countStatement.setString(1, normalizedGene);
            try (ResultSet resultSet = countStatement.executeQuery()) {
                resultSet.next();
                totalRows = resultSet.getLong("total_rows");
            }

            if (totalRows == 0) {
                return new PagedResponse<>(List.of(), page, pageSize, 0, 0, true, true);
            }

            List<GeneVariantDto> content = new ArrayList<>();
            try (PreparedStatement dataStatement = connection.prepareStatement(dataSql.formatted(toDuckDbPath(aggregateMultianno)))) {
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
            log.warn("Failed to query variants for {} / {} from {}", cancer, gene, aggregateMultianno, exception);
            return new PagedResponse<>(List.of(), page, pageSize, 0, 0, true, true);
        }
    }

    public PagedResponse<GeneVariantDto> getVariants(String cancer, String gene, String funcClass,
                                                      String exonicFunc, String chr, String sample,
                                                      Long startMin, Long startMax,
                                                      int page, int pageSize) {
        Path aggregateMultianno = resolveAggregateMultianno(validateCancer(cancer));
        if (!Files.isRegularFile(aggregateMultianno) || !hasRequiredColumns(aggregateMultianno, REQUIRED_MULTIANNO_COLUMNS)) {
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

        String countSql = "SELECT COUNT(*) AS total_rows FROM read_csv_auto('%s', delim='\\t', header=true, ignore_errors=true) "
                + whereClause;
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
                "FROM read_csv_auto('%s', delim='\\t', header=true, ignore_errors=true) " +
                whereClause +
                "ORDER BY chr ASC, start_pos ASC LIMIT ? OFFSET ?";

        long totalRows;
        try (Connection connection = DriverManager.getConnection("jdbc:duckdb:");
             PreparedStatement countStmt = connection.prepareStatement(countSql.formatted(toDuckDbPath(aggregateMultianno)))) {
            int idx = 1;
            idx = bindBrowseParams(countStmt, idx, hasGene, normalizedGene, hasFunc, funcClass,
                    hasExonic, exonicFunc, hasChr, chr, hasSample, sample, hasStartMin, startMin, hasStartMax, startMax);
            try (ResultSet rs = countStmt.executeQuery()) {
                rs.next();
                totalRows = rs.getLong("total_rows");
            }
            if (totalRows == 0) return new PagedResponse<>(List.of(), page, pageSize, 0, 0, true, true);

            List<GeneVariantDto> content = new ArrayList<>();
            try (PreparedStatement dataStmt = connection.prepareStatement(dataSql.formatted(toDuckDbPath(aggregateMultianno), toDuckDbPath(aggregateMultianno)))) {
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
        Path aggregateMultianno = resolveAggregateMultianno(validateCancer(cancer));
        if (!Files.isRegularFile(aggregateMultianno) || !hasRequiredColumns(aggregateMultianno, REQUIRED_MULTIANNO_COLUMNS)) {
            return new GeneSummaryDto(gene, cancer, 0, 0, List.of(), List.of(), List.of());
        }

        String normalizedGene = gene.trim().toLowerCase(Locale.ROOT);
        String geneFilter = "POSITION('%s' IN LOWER(COALESCE(\"Gene.refGene\", ''))) > 0".formatted(normalizedGene.replace("'", "''"));
        String filePath = toDuckDbPath(aggregateMultianno);

        String statsSql = "SELECT COUNT(*) AS total_vars, COUNT(DISTINCT Tumor_Sample_Barcode) AS unique_samples " +
                "FROM read_csv_auto('%s', delim='\\t', header=true, ignore_errors=true) WHERE %s";
        String funcSql = "SELECT COALESCE(\"Func.refGene\", '') AS label, COUNT(*) AS cnt " +
                "FROM read_csv_auto('%s', delim='\\t', header=true, ignore_errors=true) WHERE %s " +
                "GROUP BY label ORDER BY cnt DESC";
        String exonicSql = "SELECT COALESCE(\"ExonicFunc.refGene\", '') AS label, COUNT(*) AS cnt " +
                "FROM read_csv_auto('%s', delim='\\t', header=true, ignore_errors=true) WHERE %s " +
                "AND COALESCE(\"ExonicFunc.refGene\", '') <> '' AND COALESCE(\"ExonicFunc.refGene\", '') <> '.' " +
                "GROUP BY label ORDER BY cnt DESC";
        String chromSql = "SELECT COALESCE(CAST(Chr AS VARCHAR), '') AS label, COUNT(*) AS cnt " +
                "FROM read_csv_auto('%s', delim='\\t', header=true, ignore_errors=true) WHERE %s " +
                "GROUP BY label ORDER BY cnt DESC";

        try (Connection connection = DriverManager.getConnection("jdbc:duckdb:");
             Statement stmt = connection.createStatement()) {

            long totalVars = 0;
            long uniqueSamples = 0;
            try (ResultSet rs = stmt.executeQuery(statsSql.formatted(filePath, geneFilter))) {
                if (rs.next()) {
                    totalVars = rs.getLong("total_vars");
                    uniqueSamples = rs.getLong("unique_samples");
                }
            }

            List<LabelCountDto> funcBreakdown = new ArrayList<>();
            try (ResultSet rs = stmt.executeQuery(funcSql.formatted(filePath, geneFilter))) {
                while (rs.next()) funcBreakdown.add(new LabelCountDto(rs.getString("label"), rs.getLong("cnt")));
            }

            List<LabelCountDto> exonicBreakdown = new ArrayList<>();
            try (ResultSet rs = stmt.executeQuery(exonicSql.formatted(filePath, geneFilter))) {
                while (rs.next()) exonicBreakdown.add(new LabelCountDto(rs.getString("label"), rs.getLong("cnt")));
            }

            List<LabelCountDto> chromBreakdown = new ArrayList<>();
            try (ResultSet rs = stmt.executeQuery(chromSql.formatted(filePath, geneFilter))) {
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
        if (hasFunc) conditions.add("COALESCE(\"Func.refGene\", '') = ?");
        if (hasExonic) conditions.add("COALESCE(\"ExonicFunc.refGene\", '') = ?");
        if (hasChr) conditions.add("COALESCE(CAST(Chr AS VARCHAR), '') = ?");
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
        long totalVariants = 0;
        long totalSamples = 0;
        long totalGenes = 0;
        int cohortCount = 0;
        for (String cancer : CANCERS) {
            Path multianno = resolveAggregateMultianno(cancer);
            if (!Files.isRegularFile(multianno)) continue;
            cohortCount++;
            String sql = "SELECT COUNT(*) AS total_vars, " +
                    "COUNT(DISTINCT Tumor_Sample_Barcode) AS total_samples, " +
                    "COUNT(DISTINCT TRIM(gene_name)) AS total_genes " +
                    "FROM (SELECT Tumor_Sample_Barcode, UNNEST(STRING_SPLIT(COALESCE(\"Gene.refGene\",''),';')) AS gene_name " +
                    "FROM read_csv_auto('%s', delim='\\t', header=true, ignore_errors=true)) t " +
                    "WHERE TRIM(gene_name) <> '' AND TRIM(gene_name) <> '.'";
            try (Connection conn = DriverManager.getConnection("jdbc:duckdb:");
                 Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery(sql.formatted(toDuckDbPath(multianno)))) {
                if (rs.next()) {
                    totalVariants += rs.getLong("total_vars");
                    totalSamples += rs.getLong("total_samples");
                    totalGenes = Math.max(totalGenes, rs.getLong("total_genes"));
                }
            } catch (SQLException e) {
                log.warn("Stats query failed for {}: {}", cancer, e.getMessage());
            }
        }
        return new DatabaseStatsDto(totalVariants, totalSamples, totalGenes, cohortCount);
    }

    public List<String> getAllGenes(String cancer) {
        Path aggregateMultianno = resolveAggregateMultianno(validateCancer(cancer));
        if (!Files.isRegularFile(aggregateMultianno)) {
            return List.of();
        }
        String sql = "SELECT DISTINCT TRIM(gene_name) AS gene " +
                "FROM (" +
                "  SELECT UNNEST(STRING_SPLIT(COALESCE(\"Gene.refGene\", ''), ';')) AS gene_name " +
                "  FROM read_csv_auto('%s', delim='\\t', header=true, ignore_errors=true)" +
                ") split_genes " +
                "WHERE TRIM(gene_name) <> '' AND TRIM(gene_name) <> '.' " +
                "ORDER BY gene ASC";
        List<String> results = new ArrayList<>();
        try (Connection connection = DriverManager.getConnection("jdbc:duckdb:");
             Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery(sql.formatted(toDuckDbPath(aggregateMultianno)))) {
            while (rs.next()) results.add(rs.getString("gene"));
            return results;
        } catch (SQLException exception) {
            log.warn("getAllGenes failed for {}: {}", cancer, exception.getMessage());
            return List.of();
        }
    }

    public List<String> getGeneSuggestions(String cancer, String query, int limit) {
        Path aggregateMultianno = resolveAggregateMultianno(validateCancer(cancer));
        if (!Files.isRegularFile(aggregateMultianno) || query == null || query.isBlank()) {
            return List.of();
        }
        String q = query.trim().toLowerCase(Locale.ROOT);
        String sql = "SELECT DISTINCT TRIM(gene_name) AS gene " +
                "FROM (" +
                "  SELECT UNNEST(STRING_SPLIT(COALESCE(\"Gene.refGene\", ''), ';')) AS gene_name " +
                "  FROM read_csv_auto('%s', delim='\\t', header=true, ignore_errors=true)" +
                ") split_genes " +
                "WHERE TRIM(gene_name) <> '' AND TRIM(gene_name) <> '.' " +
                "  AND LOWER(TRIM(gene_name)) LIKE '%s%%' " +
                "ORDER BY gene ASC " +
                "LIMIT %d";
        List<String> results = new ArrayList<>();
        try (Connection connection = DriverManager.getConnection("jdbc:duckdb:");
             Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery(sql.formatted(toDuckDbPath(aggregateMultianno), q, limit))) {
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
                "FROM read_csv_auto('%s', delim='\\t', header=true, ignore_errors=true) " +
                "WHERE TRIM(COALESCE(\"Func.refGene\", '')) <> '' " +
                "GROUP BY label ORDER BY cnt DESC");
    }

    public List<LabelCountDto> getExonicDistribution(String cancer) {
        return queryLabelCounts(cancer,
                "SELECT TRIM(COALESCE(\"ExonicFunc.refGene\", '')) AS label, COUNT(*) AS cnt " +
                "FROM read_csv_auto('%s', delim='\\t', header=true, ignore_errors=true) " +
                "WHERE TRIM(COALESCE(\"ExonicFunc.refGene\", '')) <> '' " +
                "  AND TRIM(COALESCE(\"ExonicFunc.refGene\", '')) <> '.' " +
                "GROUP BY label ORDER BY cnt DESC");
    }

    public List<LabelCountDto> getChromDistribution(String cancer) {
        return queryLabelCounts(cancer,
                "SELECT TRIM(COALESCE(CAST(Chr AS VARCHAR), '')) AS label, COUNT(*) AS cnt " +
                "FROM read_csv_auto('%s', delim='\\t', header=true, ignore_errors=true) " +
                "WHERE TRIM(COALESCE(CAST(Chr AS VARCHAR), '')) <> '' " +
                "GROUP BY label " +
                "ORDER BY TRY_CAST(REGEXP_REPLACE(label, '^chr', '') AS INTEGER) NULLS LAST, label ASC");
    }

    public List<LabelCountDto> getSampleBurden(String cancer, int limit) {
        return queryLabelCounts(cancer,
                "SELECT TRIM(COALESCE(CAST(Tumor_Sample_Barcode AS VARCHAR), '')) AS label, COUNT(*) AS cnt " +
                "FROM read_csv_auto('%s', delim='\\t', header=true, ignore_errors=true) " +
                "WHERE TRIM(COALESCE(CAST(Tumor_Sample_Barcode AS VARCHAR), '')) <> '' " +
                "GROUP BY label ORDER BY cnt DESC LIMIT " + limit);
    }

    private List<LabelCountDto> queryLabelCounts(String cancer, String sqlTemplate) {
        Path aggregateMultianno = resolveAggregateMultianno(validateCancer(cancer));
        if (!Files.isRegularFile(aggregateMultianno)) {
            return List.of();
        }
        String sql = sqlTemplate.formatted(toDuckDbPath(aggregateMultianno));
        List<LabelCountDto> results = new ArrayList<>();
        try (Connection connection = DriverManager.getConnection("jdbc:duckdb:");
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
        List<CancerAssetDto> assets = new ArrayList<>();
        assets.addAll(discoverAssets(validatedCancer, "Plot"));
        assets.addAll(discoverAssets(validatedCancer, "TCGA"));
        assets.sort(Comparator.comparing(CancerAssetDto::getCategory).thenComparing(CancerAssetDto::getFileName));
        return assets;
    }

    public CancerAssetResource loadCancerAsset(String cancer, String fileName) {
        String validatedCancer = validateCancer(cancer);
        return getCancerAssets(validatedCancer).stream()
                .filter(asset -> asset.getFileName().equals(fileName))
                .findFirst()
                .map(asset -> {
                    Path filePath = resolveCancerDir(validatedCancer).resolve(asset.getCategory()).resolve(asset.getFileName());
                    Resource resource = new FileSystemResource(filePath);
                    return new CancerAssetResource(resource, asset.getFileName(), "application/pdf", asset.getSizeBytes());
                })
                .orElseThrow(() -> new ResourceNotFoundException("Cancer asset not found: " + fileName));
    }

    // ---- MAF Mutation queries (.duckdb database) ----

    private static final String MAF_DB_DEFAULT_FILE = "maf.duckdb";
    private static final String CFDNA_MAF_TABLE = "cfdna_maf";
    private static final String TCGA_MAF_TABLE = "tcga_maf";

    private Path resolveMafDatabaseFile() {
        return dataDir.resolve(mafDbFileName == null || mafDbFileName.isBlank() ? MAF_DB_DEFAULT_FILE : mafDbFileName);
    }

    private boolean isTcga(String source) {
        return "TCGA".equalsIgnoreCase(source);
    }

    private String resolveMafTable(String source) {
        return isTcga(source) ? TCGA_MAF_TABLE : CFDNA_MAF_TABLE;
    }

    private Connection openMafConnection() throws SQLException {
        Path mafDb = resolveMafDatabaseFile().toAbsolutePath();
        return DriverManager.getConnection("jdbc:duckdb:" + mafDb.toString());
    }

    private boolean mafDatabaseAvailable() {
        Path mafDb = resolveMafDatabaseFile();
        return Files.isRegularFile(mafDb) && Files.isReadable(mafDb);
    }

    private boolean mafTableExists(Connection connection, String tableName) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'main' AND table_name = ?")) {
            statement.setString(1, tableName);
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
        List<String> normalizedChromosomes = normalizeFilterValues(chromosomes);
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
        Path mafDb = resolveMafDatabaseFile();
        String table = resolveMafTable(source);
        if (!mafDatabaseAvailable()) {
            throw new ResourceNotFoundException("MAF database is not available.");
        }

        boolean tcga = isTcga(source);
        boolean hasSample = sample != null && !sample.isBlank();
        List<String> normalizedCancerTypes = normalizeFilterValues(cancerTypes);
        List<String> normalizedChromosomes = normalizeFilterValues(chromosomes);
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
        List<String> normalizedChromosomes = normalizeFilterValues(chromosomes);
        List<String> normalizedVariantClasses = normalizeFilterValues(variantClasses);
        List<String> normalizedVariantTypes = normalizeFilterValues(variantTypes);

        String where = buildMafExactGeneWhereClause(hasSample, normalizedCancerTypes, normalizedChromosomes, normalizedVariantClasses, normalizedVariantTypes, tcga);
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
        List<String> normalizedChromosomes = normalizeFilterValues(chromosomes);
        List<String> normalizedVariantClasses = normalizeFilterValues(variantClasses);
        List<String> normalizedVariantTypes = normalizeFilterValues(variantTypes);

        String where = buildMafWhereClause(hasGene, hasSample, normalizedCancerTypes, normalizedChromosomes, normalizedVariantClasses, normalizedVariantTypes, tcga);

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
        List<String> normalizedChromosomes = normalizeFilterValues(chromosomes);
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
        String annotationValueExpr =
                "TRIM(CONCAT_WS(' | ', NULLIF(functional_region, ''), NULLIF(exonic_function, ''), NULLIF(exon, ''), NULLIF(aa_change, '')))";

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
                : joinPreview(fetchMafGenePreviewValues(conn, table, geneSymbol, hasSample, sample, cancerTypes, chromosomes, variantClasses, variantTypes, false,
                annotationValueExpr, annotationValueExpr, "value ASC", 4));

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

    private String buildMafWhereClause(boolean hasGene, boolean hasSample, List<String> cancerTypes,
                                       List<String> chromosomes, List<String> variantClasses, List<String> variantTypes,
                                       boolean tcga) {
        List<String> conditions = new ArrayList<>();
        if (hasGene) conditions.add("LOWER(COALESCE(hugo_symbol, '')) LIKE ?");
        if (hasSample) conditions.add("LOWER(COALESCE(tumor_sample_barcode, '')) LIKE ?");
        if (!tcga && !cancerTypes.isEmpty()) conditions.add(buildInClause("cancer_type", cancerTypes.size()));
        if (!chromosomes.isEmpty()) conditions.add(buildInClause("chromosome", chromosomes.size()));
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
        if (!chromosomes.isEmpty()) conditions.add(buildInClause("chromosome", chromosomes.size()));
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
        Path cancerDir = resolveCancerDir(cancer);
        long avinputCount = countFiles(cancerDir.resolve("avinput"), ".avinput");
        long filteredVcfCount = countFiles(cancerDir.resolve("filtered_vcf"), ".filtered.vcf.gz");
        long multiannoCount = countFiles(cancerDir.resolve("multianno"), ".hg38_multianno.txt");
        long somaticCount = countFiles(cancerDir.resolve("somatic_vcf"), "_somatic.vcf.gz");
        long plotAssetCount = countFiles(cancerDir.resolve("Plot"), ".pdf");
        long externalAssetCount = countAllFiles(cancerDir.resolve("TCGA")) + countAllFiles(cancerDir.resolve("GEO"));
        long sampleCount = Math.max(avinputCount, Math.max(filteredVcfCount, multiannoCount));

        boolean hasMergedAvinput = Files.isRegularFile(cancerDir.resolve(cancer + "_merged.avinput"));
        boolean hasMergedFiltered = Files.isRegularFile(cancerDir.resolve(cancer + "_merged_filtered.vcf.gz"));
        boolean hasAggregateMultianno = Files.isRegularFile(resolveAggregateMultianno(cancer));

        return new CancerSummaryDto(
                cancer,
                sampleCount,
                avinputCount + filteredVcfCount + multiannoCount + somaticCount,
                avinputCount,
                filteredVcfCount,
                multiannoCount,
                somaticCount,
                plotAssetCount,
                externalAssetCount,
                statusLabel(avinputCount > 0 || hasMergedAvinput),
                statusLabel(filteredVcfCount > 0 || hasMergedFiltered),
                statusLabel(multiannoCount > 0 || hasAggregateMultianno),
                statusLabel(somaticCount > 0),
                statusLabel(plotAssetCount > 0),
                statusLabel(externalAssetCount > 0)
        );
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

    // ---- Statistics page: data-source-aware plot discovery ----

    private static final List<String> DATA_SOURCES = List.of("Private_cfDNA", "GEO", "TCGA");

    /**
     * Resolve the plot directory for a given cancer + source.
     * Private_cfDNA → {cancer}/Private_cfDNA/Plot/
     * GEO           → {cancer}/GEO/Plot/
     * TCGA          → {cancer}/TCGA/
     * Overview      → {cancer}/Plot/
     */
    private Path resolveStatisticsPlotDir(String cancer, String source) {
        Path cancerDir = resolveCancerDir(cancer);
        switch (source) {
            case "Private_cfDNA": return cancerDir.resolve("Private_cfDNA").resolve("Plot");
            case "GEO":          return cancerDir.resolve("GEO").resolve("Plot");
            case "TCGA":         return cancerDir.resolve("TCGA");
            case "Overview":     return cancerDir.resolve("Plot");
            default: throw new IllegalArgumentException("Unknown data source: " + source);
        }
    }

    /** List data sources that have at least one PDF plot for a cancer. */
    public List<String> getStatisticsSources(String cancer) {
        String validated = validateCancer(cancer);
        List<String> sources = new ArrayList<>();
        for (String src : DATA_SOURCES) {
            Path plotDir = resolveStatisticsPlotDir(validated, src);
            if (Files.isDirectory(plotDir) && hasDirectPdfFiles(plotDir)) {
                sources.add(src);
            }
        }
        // Also check top-level Plot/ (for cancers without sub-source dirs)
        Path overviewDir = resolveStatisticsPlotDir(validated, "Overview");
        if (Files.isDirectory(overviewDir) && hasDirectPdfFiles(overviewDir)) {
            sources.add("Overview");
        }
        return sources;
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
        Path plotDir = resolveStatisticsPlotDir(validated, source);
        if (!Files.isDirectory(plotDir)) {
            return List.of();
        }
        try (Stream<Path> stream = Files.list(plotDir)) {
            return stream
                    .filter(Files::isRegularFile)
                    .filter(p -> p.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".pdf"))
                    .sorted()
                    .map(path -> {
                        try {
                            long sizeBytes = Files.size(path);
                            String fileName = path.getFileName().toString();
                            String assetUrl = "/api/v1/statistics/" + validated + "/plots/file?source=" +
                                    UriUtils.encodeQueryParam(source, StandardCharsets.UTF_8) + "&fileName=" +
                                    UriUtils.encodeQueryParam(fileName, StandardCharsets.UTF_8);
                            return new CancerAssetDto(source, humanizeFileName(fileName), fileName, sizeBytes, assetUrl);
                        } catch (IOException e) {
                            throw new IllegalStateException("Failed to inspect " + path, e);
                        }
                    })
                    .toList();
        } catch (IOException e) {
            log.warn("Failed to list statistics plots for {}/{}", cancer, source, e);
            return List.of();
        }
    }

    /** Serve a specific statistics plot PDF file. */
    public CancerAssetResource loadStatisticsPlot(String cancer, String source, String fileName) {
        String validated = validateCancer(cancer);
        Path plotDir = resolveStatisticsPlotDir(validated, source);
        Path filePath = plotDir.resolve(fileName);
        if (!Files.isRegularFile(filePath)) {
            throw new ResourceNotFoundException("Plot not found: " + source + "/" + fileName);
        }
        try {
            long size = Files.size(filePath);
            return new CancerAssetResource(new FileSystemResource(filePath), fileName, "application/pdf", size);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read " + filePath, e);
        }
    }

    /** Find the gene lollipop plot subfolder within a plot directory. */
    private Path findGenePlotFolder(String cancer, String source) {
        Path plotDir = resolveStatisticsPlotDir(cancer, source);
        if (!Files.isDirectory(plotDir)) return null;
        try (Stream<Path> stream = Files.list(plotDir)) {
            return stream
                    .filter(Files::isDirectory)
                    .filter(d -> {
                        // Check if directory contains lollipop_*.pdf files
                        try (Stream<Path> inner = Files.list(d)) {
                            return inner.anyMatch(f -> f.getFileName().toString().startsWith("lollipop_"));
                        } catch (IOException e) {
                            return false;
                        }
                    })
                    .findFirst()
                    .orElse(null);
        } catch (IOException e) {
            return null;
        }
    }

    /** List gene names available as lollipop plots, filtered by query prefix. */
    public List<String> getGenePlotNames(String cancer, String source, String query) {
        String validated = validateCancer(cancer);
        Path geneDir = findGenePlotFolder(validated, source);
        if (geneDir == null) return List.of();
        String q = (query == null) ? "" : query.trim().toLowerCase(Locale.ROOT);
        try (Stream<Path> stream = Files.list(geneDir)) {
            return stream
                    .filter(Files::isRegularFile)
                    .map(p -> p.getFileName().toString())
                    .filter(n -> n.startsWith("lollipop_") && n.endsWith(".pdf"))
                    .map(n -> n.substring("lollipop_".length(), n.length() - ".pdf".length()))
                    .filter(gene -> q.isEmpty() || gene.toLowerCase(Locale.ROOT).startsWith(q))
                    .sorted()
                    .limit(50)
                    .toList();
        } catch (IOException e) {
            log.warn("Failed to list gene plots for {}/{}", cancer, source, e);
            return List.of();
        }
    }

    /** Check if gene lollipop plots are available for a cancer + source. */
    public boolean hasGenePlots(String cancer, String source) {
        String validated = validateCancer(cancer);
        return findGenePlotFolder(validated, source) != null;
    }

    /** Serve a specific gene lollipop plot PDF. */
    public CancerAssetResource loadGenePlot(String cancer, String source, String gene) {
        String validated = validateCancer(cancer);
        Path geneDir = findGenePlotFolder(validated, source);
        if (geneDir == null) {
            throw new ResourceNotFoundException("No gene plot folder for " + cancer + "/" + source);
        }
        String fileName = "lollipop_" + gene + ".pdf";
        Path filePath = geneDir.resolve(fileName);
        if (!Files.isRegularFile(filePath)) {
            throw new ResourceNotFoundException("Gene plot not found: " + gene);
        }
        try {
            long size = Files.size(filePath);
            return new CancerAssetResource(new FileSystemResource(filePath), fileName, "application/pdf", size);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read " + filePath, e);
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
}
