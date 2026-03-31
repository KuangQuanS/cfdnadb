package org.cfdna.database.service;

import org.cfdna.database.dto.CancerAssetDto;
import org.cfdna.database.dto.CancerSummaryDto;
import org.cfdna.database.dto.DataFileDto;
import org.cfdna.database.dto.DatabaseStatsDto;
import org.cfdna.database.dto.GeneSummaryDto;
import org.cfdna.database.dto.GeneVariantDto;
import org.cfdna.database.dto.LabelCountDto;
import org.cfdna.database.dto.PagedResponse;
import org.cfdna.database.dto.TopGeneDto;
import org.cfdna.database.exception.ResourceNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import java.util.stream.Stream;

@Service
public class DuckDbService {

    private static final Logger log = LoggerFactory.getLogger(DuckDbService.class);
    private static final Path DEFAULT_DATA_DIR = Path.of("/400T/cfdandb");
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

    public DuckDbService() {
        this(DEFAULT_DATA_DIR);
    }

    public DuckDbService(Path dataDir) {
        this.dataDir = dataDir;
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
