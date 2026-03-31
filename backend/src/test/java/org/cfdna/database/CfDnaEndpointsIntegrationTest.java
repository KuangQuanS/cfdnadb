package org.cfdna.database;

import org.cfdna.database.service.DuckDbService;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "spring.main.allow-bean-definition-overriding=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@ContextConfiguration(classes = {CfDnaDatabaseApplication.class, CfDnaEndpointsIntegrationTest.CfDnaTestConfig.class})
class CfDnaEndpointsIntegrationTest {

    private static final Path TEST_DATA_DIR = createTestDataDir();

    @Autowired
    private MockMvc mockMvc;

    @Test
    void cancerSummaryReflectsFilesystemProgress() throws Exception {
        mockMvc.perform(get("/api/v1/summary/cancers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(5)))
                .andExpect(jsonPath("$.data[0].cancer").value("Breast"))
                .andExpect(jsonPath("$.data[0].sampleCount").value(2))
                .andExpect(jsonPath("$.data[0].rawImportStatus").value("Completed"))
                .andExpect(jsonPath("$.data[0].filteredStatus").value("Completed"))
                .andExpect(jsonPath("$.data[0].annotatedStatus").value("Completed"))
                .andExpect(jsonPath("$.data[0].plotStatus").value("Completed"))
                .andExpect(jsonPath("$.data[0].externalStatus").value("Completed"))
                .andExpect(jsonPath("$.data[3].cancer").value("Lung"))
                .andExpect(jsonPath("$.data[3].rawImportStatus").value("Completed"))
                .andExpect(jsonPath("$.data[3].annotatedStatus").value("Not started"))
                .andExpect(jsonPath("$.data[4].cancer").value("Pdac"))
                .andExpect(jsonPath("$.data[4].rawImportStatus").value("Not started"));
    }

    @Test
    void topGenesReturnsSortedCountsAndRejectsInvalidCancer() throws Exception {
        mockMvc.perform(get("/api/v1/variants/top-genes")
                        .param("cancer", "Breast")
                        .param("limit", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(2)))
                .andExpect(jsonPath("$.data[0].gene").value("TP53"))
                .andExpect(jsonPath("$.data[0].count").value(2))
                .andExpect(jsonPath("$.data[1].gene").value("KRAS"))
                .andExpect(jsonPath("$.data[1].count").value(1));

        mockMvc.perform(get("/api/v1/variants/top-genes")
                        .param("cancer", "BadCancer"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Unsupported cancer cohort: BadCancer"));
    }

    @Test
    void byGeneSupportsPagingAndEmptyStates() throws Exception {
        mockMvc.perform(get("/api/v1/variants/by-gene")
                        .param("cancer", "Breast")
                        .param("gene", "TP53")
                        .param("page", "1")
                        .param("pageSize", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(2))
                .andExpect(jsonPath("$.data.totalPages").value(2))
                .andExpect(jsonPath("$.data.first").value(true))
                .andExpect(jsonPath("$.data.last").value(false))
                .andExpect(jsonPath("$.data.content", hasSize(1)))
                .andExpect(jsonPath("$.data.content[0].sample").value("BR-003"));

        mockMvc.perform(get("/api/v1/variants/by-gene")
                        .param("cancer", "Lung")
                        .param("gene", "EGFR"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(0))
                .andExpect(jsonPath("$.data.content", hasSize(0)));
    }

    @Test
    void cancerAssetsOnlyExposeSafeUrlsAndCanBePreviewed() throws Exception {
        mockMvc.perform(get("/api/v1/cancers/assets").param("cancer", "Breast"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(2)))
                .andExpect(jsonPath("$.data[0].assetUrl", startsWith("/api/v1/cancers/assets/Breast/file/")))
                .andExpect(jsonPath("$.data[0].assetUrl", not(startsWith(TEST_DATA_DIR.toString()))));

        mockMvc.perform(get("/api/v1/cancers/assets/Breast/file/Breast_oncplot.pdf"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/pdf"));
    }

    @AfterAll
    static void cleanup() throws IOException {
        if (Files.notExists(TEST_DATA_DIR)) {
            return;
        }

        try (var stream = Files.walk(TEST_DATA_DIR)) {
            stream.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException exception) {
                    throw new RuntimeException(exception);
                }
            });
        }
    }

    @TestConfiguration
    static class CfDnaTestConfig {
        @Bean
        @Primary
        DuckDbService duckDbService() {
            return new DuckDbService(TEST_DATA_DIR);
        }
    }

    private static Path createTestDataDir() {
        try {
            Path root = Files.createTempDirectory("cfdna-test-data");
            createBreastData(root.resolve("Breast"));
            createLungData(root.resolve("Lung"));
            createEmptyCancer(root.resolve("Colonrector"));
            createEmptyCancer(root.resolve("Liver"));
            createEmptyCancer(root.resolve("Pdac"));
            return root;
        } catch (IOException exception) {
            throw new RuntimeException("Failed to create test data", exception);
        }
    }

    private static void createBreastData(Path cancerDir) throws IOException {
        Files.createDirectories(cancerDir.resolve("avinput"));
        Files.createDirectories(cancerDir.resolve("filtered_vcf"));
        Files.createDirectories(cancerDir.resolve("multianno"));
        Files.createDirectories(cancerDir.resolve("somatic_vcf"));
        Files.createDirectories(cancerDir.resolve("Plot"));
        Files.createDirectories(cancerDir.resolve("TCGA"));
        Files.createDirectories(cancerDir.resolve("GEO"));

        Files.writeString(cancerDir.resolve("avinput/BR-001.avinput"), "sample");
        Files.writeString(cancerDir.resolve("avinput/BR-002.avinput"), "sample");
        Files.writeString(cancerDir.resolve("filtered_vcf/BR-001.filtered.vcf.gz"), "vcf");
        Files.writeString(cancerDir.resolve("filtered_vcf/BR-002.filtered.vcf.gz"), "vcf");
        Files.writeString(cancerDir.resolve("multianno/BR-001.hg38_multianno.txt"), "anno");
        Files.writeString(cancerDir.resolve("multianno/BR-002.hg38_multianno.txt"), "anno");
        Files.writeString(cancerDir.resolve("somatic_vcf/BR-001_somatic.vcf.gz"), "vcf");
        Files.writeString(cancerDir.resolve("Plot/Breast_oncplot.pdf"), "%PDF-test");
        Files.writeString(cancerDir.resolve("TCGA/TCGA-BRCA-summary.pdf"), "%PDF-test");
        Files.writeString(cancerDir.resolve("GEO/GSE-demo.txt"), "geo");
        Files.writeString(cancerDir.resolve("Breast_merged.avinput"), "merged");
        Files.writeString(cancerDir.resolve("Breast_merged_filtered.vcf.gz"), "merged");
        Files.writeString(cancerDir.resolve("Breast_all_sample_multianno.txt"),
                "Chr\tStart\tEnd\tRef\tAlt\tFunc.refGene\tGene.refGene\tTumor_Sample_Barcode\n" +
                        "chr17\t7579472\t7579472\tC\tT\texonic\tTP53\tBR-001\n" +
                        "chr12\t25245350\t25245350\tG\tA\texonic\tKRAS\tBR-002\n" +
                        "chr17\t7578406\t7578406\tC\tT\texonic\tTP53;MDM2\tBR-003\n");
    }

    private static void createLungData(Path cancerDir) throws IOException {
        Files.createDirectories(cancerDir.resolve("avinput"));
        Files.createDirectories(cancerDir.resolve("filtered_vcf"));
        Files.createDirectories(cancerDir.resolve("multianno"));
        Files.createDirectories(cancerDir.resolve("somatic_vcf"));
        Files.createDirectories(cancerDir.resolve("Plot"));

        Files.writeString(cancerDir.resolve("avinput/LU-001.avinput"), "sample");
        Files.writeString(cancerDir.resolve("filtered_vcf/LU-001.filtered.vcf.gz"), "vcf");
    }

    private static void createEmptyCancer(Path cancerDir) throws IOException {
        Files.createDirectories(cancerDir.resolve("avinput"));
        Files.createDirectories(cancerDir.resolve("filtered_vcf"));
        Files.createDirectories(cancerDir.resolve("multianno"));
        Files.createDirectories(cancerDir.resolve("somatic_vcf"));
        Files.createDirectories(cancerDir.resolve("Plot"));
    }
}
