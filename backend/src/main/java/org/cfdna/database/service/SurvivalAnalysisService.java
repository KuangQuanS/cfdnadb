package org.cfdna.database.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeSet;

/**
 * Survival analysis against TCGA MAF + clinical + survival files (read via DuckDB).
 * Data layout: {tcgaDir}/TCGA-XXX/{TCGA-XXX.somaticmutation_wxs.tsv, *.survival.tsv.gz, *.clinical.tsv.gz}
 */
@Service
public class SurvivalAnalysisService {

    private static final Logger log = LoggerFactory.getLogger(SurvivalAnalysisService.class);

    private static final List<String> SUPPORTED_COHORTS = List.of(
            "TCGA-BLCA", "TCGA-BRCA", "TCGA-CESC", "TCGA-COAD", "TCGA-ESCA",
            "TCGA-GBM", "TCGA-HNSC", "TCGA-KIRC", "TCGA-LIHC", "TCGA-LUAD",
            "TCGA-OV", "TCGA-PAAD", "TCGA-STAD", "TCGA-THCA", "TCGA-UCEC"
    );
    private static final String CFMETHDB_FILE = "cfMethDB.txt";
    private static final String CFOMICS_METHYLATION_FILE = "cfOmics_methylation.txt";
    private static final String CTC_RBASE_FILE = "ctcRbase_all_cancers_long.txt";

    /** Ordered mutation-type categories for plotting. */
    public static final List<String> MUTATION_TYPES = List.of(
            "Frameshift", "Missense", "Nonsense", "Splice_Site", "Inframe", "Synonymous", "Other"
    );

    private final Path tcgaDir;
    private final Path databaseDir;

    public SurvivalAnalysisService(@Value("${app.tcga-dir:/400T/cfDNAweb/tcga}") String tcgaDir,
                                   @Value("${app.data-dir:/400T/cfdnaweb}") String dataDir) {
        this.tcgaDir = Path.of(tcgaDir);
        this.databaseDir = Path.of(dataDir).resolve("DataBase");
    }

    @PostConstruct
    void init() {
        try {
            Class.forName("org.duckdb.DuckDBDriver");
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException("DuckDB JDBC driver not on classpath", e);
        }
        if (!Files.isDirectory(tcgaDir)) {
            log.warn("TCGA data dir not found: {} — survival analysis endpoints will return empty results", tcgaDir);
        } else {
            log.info("Survival analysis TCGA dir = {}", tcgaDir);
        }
        if (!Files.isDirectory(databaseDir)) {
            log.warn("Multi-omics database dir not found: {}", databaseDir);
        } else {
            log.info("Survival analysis multi-omics database dir = {}", databaseDir);
        }
    }

    public List<String> listCohorts() {
        List<String> available = new ArrayList<>();
        for (String cohort : SUPPORTED_COHORTS) {
            if (Files.isDirectory(tcgaDir.resolve(cohort))) {
                available.add(cohort);
            }
        }
        return available;
    }

    // =============================================================
    // Data loaders
    // =============================================================

    /** Patient -> (os_time_days, os_status). */
    private Map<String, double[]> loadSurvival(Connection con, String cohort) throws Exception {
        Path file = tcgaDir.resolve(cohort).resolve(cohort + ".survival.tsv.gz");
        Map<String, double[]> out = new LinkedHashMap<>();
        if (!Files.isRegularFile(file)) {
            return out;
        }
        String sql = "SELECT substr(sample,1,12) AS patient, \"OS.time\" AS t, OS AS s " +
                "FROM read_csv_auto('" + file.toString().replace("'", "''") + "', delim='\t', header=true)";
        try (PreparedStatement ps = con.prepareStatement(sql); ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                String p = rs.getString("patient");
                double t = rs.getDouble("t");
                if (rs.wasNull()) continue;
                int s = rs.getInt("s");
                out.putIfAbsent(p, new double[]{t, s});
            }
        }
        return out;
    }

    /** Patient -> main pathologic stage (I/II/III/IV) or null. */
    private Map<String, String> loadStage(Connection con, String cohort) throws Exception {
        Path file = tcgaDir.resolve(cohort).resolve(cohort + ".clinical.tsv.gz");
        Map<String, String> out = new HashMap<>();
        if (!Files.isRegularFile(file)) {
            return out;
        }
        String sql = "SELECT substr(sample,1,12) AS patient, \"ajcc_pathologic_stage.diagnoses\" AS stage " +
                "FROM read_csv_auto('" + file.toString().replace("'", "''") + "', delim='\t', header=true, ignore_errors=true)";
        try (PreparedStatement ps = con.prepareStatement(sql); ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                String p = rs.getString("patient");
                String raw = rs.getString("stage");
                String main = normalizeStage(raw);
                if (main != null) out.putIfAbsent(p, main);
            }
        }
        return out;
    }

    /** For a gene, return Patient -> {effectClass, vaf}. Patients with multiple records collapse to the highest-priority effect. */
    private Map<String, MutationRecord> loadGeneMutations(Connection con, String cohort, String gene) throws Exception {
        Path file = tcgaDir.resolve(cohort).resolve(cohort + ".somaticmutation_wxs.tsv");
        Map<String, MutationRecord> out = new HashMap<>();
        if (!Files.isRegularFile(file)) {
            return out;
        }
        String sql = "SELECT substr(sample,1,12) AS patient, effect, dna_vaf " +
                "FROM read_csv_auto('" + file.toString().replace("'", "''") + "', delim='\t', header=true) " +
                "WHERE gene = ?";
        try (PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, gene);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String patient = rs.getString("patient");
                    String effect = rs.getString("effect");
                    double vaf = rs.getDouble("dna_vaf");
                    if (rs.wasNull()) vaf = Double.NaN;
                    String cls = classifyEffect(effect);
                    MutationRecord existing = out.get(patient);
                    if (existing == null || effectPriority(cls) < effectPriority(existing.effectClass)) {
                        out.put(patient, new MutationRecord(cls, vaf));
                    }
                }
            }
        }
        return out;
    }

    private static String normalizeStage(String raw) {
        if (raw == null) return null;
        String s = raw.trim().toUpperCase(Locale.ROOT);
        if (s.isEmpty() || s.equals("NA") || s.equals("NOT REPORTED") || s.equals("--")) return null;
        // Expected: "Stage I", "Stage IIA", "Stage III", "Stage IV"
        if (!s.startsWith("STAGE")) return null;
        String rest = s.substring(5).trim();
        if (rest.startsWith("IV")) return "IV";
        if (rest.startsWith("III")) return "III";
        if (rest.startsWith("II")) return "II";
        if (rest.startsWith("I")) return "I";
        return null;
    }

    private static String classifyEffect(String effect) {
        if (effect == null) return "Other";
        String e = effect.toLowerCase(Locale.ROOT);
        if (e.contains("frameshift_variant")) return "Frameshift";
        if (e.contains("stop_gained") || e.contains("stop_lost")) return "Nonsense";
        if (e.contains("splice_acceptor_variant") || e.contains("splice_donor_variant")) return "Splice_Site";
        if (e.contains("missense_variant")) return "Missense";
        if (e.contains("inframe_deletion") || e.contains("inframe_insertion")) return "Inframe";
        if (e.contains("synonymous_variant")) return "Synonymous";
        return "Other";
    }

    private static int effectPriority(String cls) {
        switch (cls) {
            case "Frameshift": return 0;
            case "Nonsense":   return 1;
            case "Splice_Site":return 2;
            case "Missense":   return 3;
            case "Inframe":    return 4;
            case "Synonymous": return 5;
            default:           return 6;
        }
    }

    // =============================================================
    // Public API
    // =============================================================

    public KmResult kmByMutationStatus(String cohort, String gene, String timeUnit) {
        try (Connection con = DriverManager.getConnection("jdbc:duckdb:")) {
            Map<String, double[]> surv = loadSurvival(con, cohort);
            Map<String, MutationRecord> muts = loadGeneMutations(con, cohort, gene);

            List<Sample> mutant = new ArrayList<>();
            List<Sample> wildtype = new ArrayList<>();
            for (Map.Entry<String, double[]> e : surv.entrySet()) {
                double[] ts = e.getValue();
                double time = convertTime(ts[0], timeUnit);
                int status = (int) ts[1];
                Sample s = new Sample(time, status);
                if (muts.containsKey(e.getKey())) mutant.add(s);
                else wildtype.add(s);
            }

            KmResult result = new KmResult();
            result.cohort = cohort;
            result.gene = gene;
            result.timeUnit = timeUnit;
            result.groups = new LinkedHashMap<>();
            result.groups.put("Mutant", buildGroup("Mutant", mutant));
            result.groups.put("Wildtype", buildGroup("Wildtype", wildtype));
            result.pairwiseP = new LinkedHashMap<>();
            result.pairwiseHr = new LinkedHashMap<>();
            result.pairwiseP.put("Mutant_vs_Wildtype", logRankP(mutant, wildtype));
            result.pairwiseHr.put("Mutant_vs_Wildtype", hazardRatio(mutant, wildtype));
            result.overallP = result.pairwiseP.get("Mutant_vs_Wildtype");
            return result;
        } catch (Exception ex) {
            throw new RuntimeException("kmByMutationStatus failed: " + ex.getMessage(), ex);
        }
    }

    public KmResult kmByMutationType(String cohort, String gene, String timeUnit) {
        try (Connection con = DriverManager.getConnection("jdbc:duckdb:")) {
            Map<String, double[]> surv = loadSurvival(con, cohort);
            Map<String, MutationRecord> muts = loadGeneMutations(con, cohort, gene);

            Map<String, List<Sample>> bucketed = new LinkedHashMap<>();
            for (String t : MUTATION_TYPES) bucketed.put(t, new ArrayList<>());
            List<Sample> wildtype = new ArrayList<>();

            for (Map.Entry<String, double[]> e : surv.entrySet()) {
                double[] ts = e.getValue();
                double time = convertTime(ts[0], timeUnit);
                int status = (int) ts[1];
                Sample s = new Sample(time, status);
                MutationRecord mr = muts.get(e.getKey());
                if (mr == null) wildtype.add(s);
                else bucketed.get(mr.effectClass).add(s);
            }

            KmResult result = new KmResult();
            result.cohort = cohort;
            result.gene = gene;
            result.timeUnit = timeUnit;
            result.groups = new LinkedHashMap<>();
            for (Map.Entry<String, List<Sample>> b : bucketed.entrySet()) {
                if (!b.getValue().isEmpty()) {
                    result.groups.put(b.getKey(), buildGroup(b.getKey(), b.getValue()));
                }
            }
            result.groups.put("Wildtype", buildGroup("Wildtype", wildtype));

            result.pairwiseP = new LinkedHashMap<>();
            result.pairwiseHr = new LinkedHashMap<>();
            for (Map.Entry<String, List<Sample>> b : bucketed.entrySet()) {
                if (b.getValue().size() < 2) continue;
                result.pairwiseP.put(b.getKey() + "_vs_Wildtype", logRankP(b.getValue(), wildtype));
                result.pairwiseHr.put(b.getKey() + "_vs_Wildtype", hazardRatio(b.getValue(), wildtype));
            }
            return result;
        } catch (Exception ex) {
            throw new RuntimeException("kmByMutationType failed: " + ex.getMessage(), ex);
        }
    }

    public VafResult vafByStage(String cohort, String gene) {
        try (Connection con = DriverManager.getConnection("jdbc:duckdb:")) {
            Map<String, String> stages = loadStage(con, cohort);
            Map<String, MutationRecord> muts = loadGeneMutations(con, cohort, gene);

            Map<String, List<Double>> bucketed = new LinkedHashMap<>();
            for (String s : List.of("I", "II", "III", "IV")) bucketed.put(s, new ArrayList<>());

            for (Map.Entry<String, MutationRecord> e : muts.entrySet()) {
                double v = e.getValue().vaf;
                if (Double.isNaN(v)) continue;
                String st = stages.get(e.getKey());
                if (st != null && bucketed.containsKey(st)) bucketed.get(st).add(v);
            }

            VafResult res = new VafResult();
            res.cohort = cohort;
            res.gene = gene;
            res.xLabel = "Pathologic Stage";
            res.groups = new LinkedHashMap<>();
            for (Map.Entry<String, List<Double>> b : bucketed.entrySet()) {
                if (!b.getValue().isEmpty()) res.groups.put(b.getKey(), boxplotStats(b.getValue()));
            }
            res.pairwiseP = new LinkedHashMap<>();
            List<String> keys = new ArrayList<>(res.groups.keySet());
            for (int i = 0; i < keys.size(); i++) {
                for (int j = i + 1; j < keys.size(); j++) {
                    String ki = keys.get(i), kj = keys.get(j);
                    double p = wilcoxonP(bucketed.get(ki), bucketed.get(kj));
                    res.pairwiseP.put(ki + "_vs_" + kj, p);
                }
            }
            return res;
        } catch (Exception ex) {
            throw new RuntimeException("vafByStage failed: " + ex.getMessage(), ex);
        }
    }

    public VafResult vafByMutationType(String cohort, String gene) {
        try (Connection con = DriverManager.getConnection("jdbc:duckdb:")) {
            Map<String, MutationRecord> muts = loadGeneMutations(con, cohort, gene);

            Map<String, List<Double>> bucketed = new LinkedHashMap<>();
            for (String t : MUTATION_TYPES) bucketed.put(t, new ArrayList<>());
            for (MutationRecord mr : muts.values()) {
                if (!Double.isNaN(mr.vaf)) bucketed.get(mr.effectClass).add(mr.vaf);
            }

            VafResult res = new VafResult();
            res.cohort = cohort;
            res.gene = gene;
            res.xLabel = "Mutation Type";
            res.groups = new LinkedHashMap<>();
            List<List<Double>> nonEmpty = new ArrayList<>();
            for (Map.Entry<String, List<Double>> b : bucketed.entrySet()) {
                if (!b.getValue().isEmpty()) {
                    res.groups.put(b.getKey(), boxplotStats(b.getValue()));
                    nonEmpty.add(b.getValue());
                }
            }
            res.overallP = nonEmpty.size() >= 2 ? kruskalWallisP(nonEmpty) : Double.NaN;
            return res;
        } catch (Exception ex) {
            throw new RuntimeException("vafByMutationType failed: " + ex.getMessage(), ex);
        }
    }

    public VafResult cfMethDbMethylation(String gene) {
        Path file = databaseDir.resolve(CFMETHDB_FILE);
        try (Connection con = DriverManager.getConnection("jdbc:duckdb:")) {
            return loadOmicsBoxplot(
                    con,
                    file,
                    "cfMethDB",
                    gene,
                    "GeneName",
                    "CancerType",
                    "MeDiff",
                    "cfMethDB methylation by cancer type",
                    "Cancer Type",
                    "Methylation difference (MeDiff)",
                    "value",
                    false);
        } catch (Exception ex) {
            throw new RuntimeException("cfMethDbMethylation failed: " + ex.getMessage(), ex);
        }
    }

    public VafResult cfOmicsMethylation(String gene) {
        Path file = databaseDir.resolve(CFOMICS_METHYLATION_FILE);
        try (Connection con = DriverManager.getConnection("jdbc:duckdb:")) {
            return loadOmicsBoxplot(
                    con,
                    file,
                    "cfOmics methylation",
                    gene,
                    "hgnc_symbol",
                    "cancer_name",
                    "methylation_value",
                    "cfOmics methylation by cancer type",
                    "Cancer Type",
                    "Methylation value",
                    "value",
                    false);
        } catch (Exception ex) {
            throw new RuntimeException("cfOmicsMethylation failed: " + ex.getMessage(), ex);
        }
    }

    public VafResult ctcExpression(String gene) {
        Path file = databaseDir.resolve(CTC_RBASE_FILE);
        try (Connection con = DriverManager.getConnection("jdbc:duckdb:")) {
            return loadOmicsBoxplot(
                    con,
                    file,
                    "ctcRbase",
                    gene,
                    "regexp_extract(Gene, '[^_]+$')",
                    "Cancer_Type",
                    "FPKM",
                    "CTC expression by cancer type",
                    "Cancer Type",
                    "FPKM expression (log scale)",
                    "log",
                    true);
        } catch (Exception ex) {
            throw new RuntimeException("ctcExpression failed: " + ex.getMessage(), ex);
        }
    }

    private VafResult loadOmicsBoxplot(Connection con,
                                      Path file,
                                      String source,
                                      String gene,
                                      String geneExpression,
                                      String groupColumn,
                                      String valueColumn,
                                      String title,
                                      String xLabel,
                                      String yLabel,
                                      String yScale,
                                      boolean floorForLogScale) throws Exception {
        VafResult res = new VafResult();
        res.cohort = source;
        res.gene = gene;
        res.xLabel = xLabel;
        res.yLabel = yLabel;
        res.yScale = yScale;
        res.title = title;
        res.groups = new LinkedHashMap<>();
        res.pairwiseP = new LinkedHashMap<>();

        if (!Files.isRegularFile(file)) {
            log.warn("Multi-omics file missing: {}", file);
            return res;
        }

        String escapedPath = file.toString().replace("\\", "/").replace("'", "''");
        String valueExpr = "try_cast(\"" + valueColumn + "\" AS DOUBLE)";
        String sql = "SELECT \"" + groupColumn + "\" AS cancer_type, " + valueExpr + " AS value " +
                "FROM read_csv_auto('" + escapedPath + "', delim='\t', header=true, ignore_errors=true) " +
                "WHERE upper(" + geneExpression + ") = upper(?) " +
                "AND " + valueExpr + " IS NOT NULL " +
                "AND \"" + groupColumn + "\" IS NOT NULL";

        Map<String, List<Double>> bucketed = new LinkedHashMap<>();
        try (PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, gene);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String cancerType = rs.getString("cancer_type");
                    double value = rs.getDouble("value");
                    if (rs.wasNull() || cancerType == null || cancerType.isBlank()) continue;
                    if (floorForLogScale && value <= 0.0) value = 0.01;
                    bucketed.computeIfAbsent(cancerType, key -> new ArrayList<>()).add(value);
                }
            }
        }

        List<List<Double>> nonEmpty = new ArrayList<>();
        for (Map.Entry<String, List<Double>> entry : bucketed.entrySet()) {
            if (!entry.getValue().isEmpty()) {
                res.groups.put(entry.getKey(), boxplotStats(entry.getValue()));
                nonEmpty.add(entry.getValue());
            }
        }
        res.overallP = nonEmpty.size() >= 2 ? kruskalWallisP(nonEmpty) : Double.NaN;
        return res;
    }

    // =============================================================
    // Statistics helpers (KM, log-rank, Wilcoxon, Kruskal-Wallis)
    // =============================================================

    private static double convertTime(double days, String unit) {
        if ("days".equalsIgnoreCase(unit)) return days;
        return days / 30.4375; // months
    }

    /** Compute KM step curve (survival probability at each distinct event time) + at-risk table points. */
    private static KmGroup buildGroup(String name, List<Sample> samples) {
        KmGroup g = new KmGroup();
        g.name = name;
        g.n = samples.size();
        g.events = 0;
        g.points = new ArrayList<>();
        g.ciUpper = new ArrayList<>();
        g.ciLower = new ArrayList<>();
        g.censorMarks = new ArrayList<>();
        g.atRisk = new ArrayList<>();
        if (samples.isEmpty()) {
            return g;
        }
        List<Sample> sorted = new ArrayList<>(samples);
        sorted.sort((a, b) -> Double.compare(a.time, b.time));

        TreeSet<Double> distinctTimes = new TreeSet<>();
        for (Sample s : sorted) distinctTimes.add(s.time);

        int atRisk = sorted.size();
        double surv = 1.0;
        double greenwood = 0.0;
        int idx = 0;
        // seed point at t=0
        g.points.add(new double[]{0.0, 1.0});
        g.ciUpper.add(new double[]{0.0, 1.0});
        g.ciLower.add(new double[]{0.0, 1.0});
        for (double t : distinctTimes) {
            int d = 0, c = 0;
            while (idx < sorted.size() && Double.compare(sorted.get(idx).time, t) == 0) {
                if (sorted.get(idx).status == 1) d++;
                else c++;
                idx++;
            }
            if (atRisk > 0 && d > 0) {
                if (atRisk - d > 0) {
                    greenwood += (double) d / ((double) atRisk * (atRisk - d));
                }
                surv *= (1.0 - (double) d / atRisk);
                g.events += d;
            }
            g.points.add(new double[]{t, surv});
            double se = surv * Math.sqrt(Math.max(greenwood, 0.0));
            double lower = Math.max(0.0, surv - 1.96 * se);
            double upper = Math.min(1.0, surv + 1.96 * se);
            g.ciLower.add(new double[]{t, lower});
            g.ciUpper.add(new double[]{t, upper});
            for (int j = 0; j < c; j++) {
                g.censorMarks.add(new double[]{t, surv});
            }
            atRisk -= (d + c);
        }
        // At-risk table: 5 evenly spaced time points
        double tmax = distinctTimes.last();
        double[] gridTimes = new double[]{0, tmax * 0.25, tmax * 0.5, tmax * 0.75, tmax};
        for (double tg : gridTimes) {
            int n = 0;
            for (Sample s : sorted) if (s.time >= tg) n++;
            g.atRisk.add(new double[]{tg, n});
        }
        return g;
    }

    /** Two-group log-rank test p-value (chi-square, 1 df). */
    private static double logRankP(List<Sample> a, List<Sample> b) {
        if (a.isEmpty() || b.isEmpty()) return Double.NaN;
        TreeSet<Double> tset = new TreeSet<>();
        for (Sample s : a) if (s.status == 1) tset.add(s.time);
        for (Sample s : b) if (s.status == 1) tset.add(s.time);
        if (tset.isEmpty()) return Double.NaN;

        double oMinusE = 0.0;
        double v = 0.0;
        for (double t : tset) {
            int n1 = countAtRisk(a, t);
            int n2 = countAtRisk(b, t);
            int d1 = countEvents(a, t);
            int d2 = countEvents(b, t);
            int n = n1 + n2, d = d1 + d2;
            if (n < 2 || d == 0) continue;
            double e1 = (double) d * n1 / n;
            oMinusE += d1 - e1;
            if (n > 1) {
                v += ((double) d * (n - d) * n1 * n2) / ((double) n * n * (n - 1));
            }
        }
        if (v <= 0) return Double.NaN;
        double chi = (oMinusE * oMinusE) / v;
        return 1.0 - chiSquaredCdf1Df(chi);
    }

    private static int countAtRisk(List<Sample> g, double t) {
        int c = 0;
        for (Sample s : g) if (s.time >= t) c++;
        return c;
    }

    private static int countEvents(List<Sample> g, double t) {
        int c = 0;
        for (Sample s : g) if (s.time == t && s.status == 1) c++;
        return c;
    }

    /** Simple hazard-rate ratio using events per person-time, with small continuity correction. */
    private static double hazardRatio(List<Sample> exposed, List<Sample> reference) {
        if (exposed.isEmpty() || reference.isEmpty()) return Double.NaN;
        double exposedEvents = 0.0;
        double referenceEvents = 0.0;
        double exposedTime = 0.0;
        double referenceTime = 0.0;

        for (Sample s : exposed) {
            exposedTime += Math.max(s.time, 0.0);
            if (s.status == 1) exposedEvents += 1.0;
        }
        for (Sample s : reference) {
            referenceTime += Math.max(s.time, 0.0);
            if (s.status == 1) referenceEvents += 1.0;
        }

        if (exposedTime <= 0 || referenceTime <= 0) return Double.NaN;
        double exposedHazard = (exposedEvents + 0.5) / exposedTime;
        double referenceHazard = (referenceEvents + 0.5) / referenceTime;
        return referenceHazard > 0 ? exposedHazard / referenceHazard : Double.NaN;
    }

    /** Boxplot 5-number summary + outliers + jitter points. */
    private static BoxStats boxplotStats(List<Double> vals) {
        BoxStats b = new BoxStats();
        b.n = vals.size();
        double[] arr = vals.stream().mapToDouble(Double::doubleValue).sorted().toArray();
        b.min = arr[0];
        b.max = arr[arr.length - 1];
        b.q1 = quantile(arr, 0.25);
        b.median = quantile(arr, 0.50);
        b.q3 = quantile(arr, 0.75);
        double iqr = b.q3 - b.q1;
        double lo = b.q1 - 1.5 * iqr;
        double hi = b.q3 + 1.5 * iqr;
        b.whiskerLow = arr[0];
        for (double x : arr) { if (x >= lo) { b.whiskerLow = x; break; } }
        b.whiskerHigh = arr[arr.length - 1];
        for (int i = arr.length - 1; i >= 0; i--) { if (arr[i] <= hi) { b.whiskerHigh = arr[i]; break; } }
        b.points = new ArrayList<>();
        for (double x : arr) b.points.add(x);
        return b;
    }

    private static double quantile(double[] sorted, double q) {
        if (sorted.length == 0) return Double.NaN;
        if (sorted.length == 1) return sorted[0];
        double pos = q * (sorted.length - 1);
        int lo = (int) Math.floor(pos);
        int hi = (int) Math.ceil(pos);
        if (lo == hi) return sorted[lo];
        return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
    }

    /** Two-sided Wilcoxon rank-sum (Mann-Whitney U) p-value with tie correction, normal approximation. */
    private static double wilcoxonP(List<Double> a, List<Double> b) {
        int n1 = a.size(), n2 = b.size();
        if (n1 == 0 || n2 == 0) return Double.NaN;
        int n = n1 + n2;
        double[] all = new double[n];
        int[] grp = new int[n];
        int k = 0;
        for (double x : a) { all[k] = x; grp[k++] = 0; }
        for (double x : b) { all[k] = x; grp[k++] = 1; }
        Integer[] order = new Integer[n];
        for (int i = 0; i < n; i++) order[i] = i;
        Arrays.sort(order, (i, j) -> Double.compare(all[i], all[j]));
        double[] ranks = new double[n];
        double tieSum = 0;
        int i = 0;
        while (i < n) {
            int j = i;
            while (j + 1 < n && all[order[j + 1]] == all[order[i]]) j++;
            double avgRank = (i + j) / 2.0 + 1.0;
            int tieLen = j - i + 1;
            if (tieLen > 1) tieSum += (double) tieLen * tieLen * tieLen - tieLen;
            for (int m = i; m <= j; m++) ranks[order[m]] = avgRank;
            i = j + 1;
        }
        double r1 = 0;
        for (int idx = 0; idx < n; idx++) if (grp[idx] == 0) r1 += ranks[idx];
        double u1 = r1 - (double) n1 * (n1 + 1) / 2.0;
        double meanU = (double) n1 * n2 / 2.0;
        double varU = ((double) n1 * n2 / 12.0) * ((n + 1) - tieSum / ((double) n * (n - 1)));
        if (varU <= 0) return Double.NaN;
        double z = (u1 - meanU) / Math.sqrt(varU);
        return 2.0 * (1.0 - normalCdf(Math.abs(z)));
    }

    /** Kruskal-Wallis H test p-value (chi-square, k-1 df) with tie correction. */
    private static double kruskalWallisP(List<List<Double>> groups) {
        int k = groups.size();
        int n = 0;
        for (List<Double> g : groups) n += g.size();
        if (k < 2 || n < 3) return Double.NaN;
        double[] all = new double[n];
        int[] gid = new int[n];
        int idx = 0;
        for (int gi = 0; gi < k; gi++) {
            for (double x : groups.get(gi)) { all[idx] = x; gid[idx++] = gi; }
        }
        Integer[] order = new Integer[n];
        for (int i = 0; i < n; i++) order[i] = i;
        Arrays.sort(order, (i, j) -> Double.compare(all[i], all[j]));
        double[] ranks = new double[n];
        double tieSum = 0;
        int i = 0;
        while (i < n) {
            int j = i;
            while (j + 1 < n && all[order[j + 1]] == all[order[i]]) j++;
            double avgRank = (i + j) / 2.0 + 1.0;
            int tieLen = j - i + 1;
            if (tieLen > 1) tieSum += (double) tieLen * tieLen * tieLen - tieLen;
            for (int m = i; m <= j; m++) ranks[order[m]] = avgRank;
            i = j + 1;
        }
        double[] rSum = new double[k];
        int[] nG = new int[k];
        for (int m = 0; m < n; m++) { rSum[gid[m]] += ranks[m]; nG[gid[m]]++; }
        double h = 0;
        for (int gi = 0; gi < k; gi++) {
            if (nG[gi] > 0) h += (rSum[gi] * rSum[gi]) / nG[gi];
        }
        h = (12.0 / ((double) n * (n + 1))) * h - 3.0 * (n + 1);
        double tieCorr = 1.0 - tieSum / ((double) n * n * n - n);
        if (tieCorr > 0) h /= tieCorr;
        return 1.0 - chiSquaredCdf(h, k - 1);
    }

    // ---- Distribution helpers ----

    private static double normalCdf(double z) {
        return 0.5 * (1.0 + erf(z / Math.sqrt(2)));
    }

    /** Abramowitz & Stegun 7.1.26 approximation. */
    private static double erf(double x) {
        double sign = x < 0 ? -1 : 1;
        x = Math.abs(x);
        double a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
        double a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
        double t = 1.0 / (1.0 + p * x);
        double y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        return sign * y;
    }

    private static double chiSquaredCdf1Df(double x) {
        if (x <= 0) return 0;
        return erf(Math.sqrt(x / 2.0));
    }

    /** Chi-square CDF via regularized lower incomplete gamma P(k/2, x/2). */
    private static double chiSquaredCdf(double x, int df) {
        if (x <= 0) return 0;
        return regularizedGammaP(df / 2.0, x / 2.0);
    }

    /** Series + continued-fraction approximation for P(a,x). */
    private static double regularizedGammaP(double a, double x) {
        if (x < 0 || a <= 0) return Double.NaN;
        if (x == 0) return 0;
        if (x < a + 1.0) {
            double ap = a;
            double sum = 1.0 / a;
            double del = sum;
            for (int n = 1; n < 200; n++) {
                ap += 1.0;
                del *= x / ap;
                sum += del;
                if (Math.abs(del) < Math.abs(sum) * 1e-12) break;
            }
            return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
        } else {
            double b = x + 1.0 - a;
            double c = 1e300;
            double d = 1.0 / b;
            double h = d;
            for (int n = 1; n < 200; n++) {
                double an = -n * (n - a);
                b += 2.0;
                d = an * d + b;
                if (Math.abs(d) < 1e-300) d = 1e-300;
                c = b + an / c;
                if (Math.abs(c) < 1e-300) c = 1e-300;
                d = 1.0 / d;
                double delta = d * c;
                h *= delta;
                if (Math.abs(delta - 1.0) < 1e-12) break;
            }
            double q = Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
            return 1.0 - q;
        }
    }

    private static double logGamma(double x) {
        double[] c = {76.18009172947146, -86.50532032941677, 24.01409824083091,
                -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5};
        double y = x, t = x + 5.5;
        t -= (x + 0.5) * Math.log(t);
        double sum = 1.000000000190015;
        for (int j = 0; j < 6; j++) { y += 1.0; sum += c[j] / y; }
        return -t + Math.log(2.5066282746310005 * sum / x);
    }

    // =============================================================
    // DTO classes
    // =============================================================

    private static class Sample {
        final double time;
        final int status;
        Sample(double time, int status) { this.time = time; this.status = status; }
    }

    private static class MutationRecord {
        final String effectClass;
        final double vaf;
        MutationRecord(String effectClass, double vaf) { this.effectClass = effectClass; this.vaf = vaf; }
    }

    public static class KmResult {
        public String cohort;
        public String gene;
        public String timeUnit;
        public Map<String, KmGroup> groups;
        public Map<String, Double> pairwiseP;
        public Map<String, Double> pairwiseHr;
        public Double overallP;
    }

    public static class KmGroup {
        public String name;
        public int n;
        public int events;
        /** Each entry: [time, survivalProbability]. */
        public List<double[]> points;
        /** Each entry: [time, ciUpper]. */
        public List<double[]> ciUpper;
        /** Each entry: [time, ciLower]. */
        public List<double[]> ciLower;
        /** Each entry: [time, survivalAtCensor]. */
        public List<double[]> censorMarks;
        /** Each entry: [time, atRiskCount]. */
        public List<double[]> atRisk;
    }

    public static class VafResult {
        public String cohort;
        public String gene;
        public String title;
        public String xLabel;
        public String yLabel;
        public String yScale;
        public Map<String, BoxStats> groups;
        public Map<String, Double> pairwiseP;
        public Double overallP;
    }

    public static class BoxStats {
        public int n;
        public double min;
        public double q1;
        public double median;
        public double q3;
        public double max;
        public double whiskerLow;
        public double whiskerHigh;
        public List<Double> points;
    }
}
