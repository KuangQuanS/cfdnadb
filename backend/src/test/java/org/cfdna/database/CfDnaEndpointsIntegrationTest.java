package org.cfdna.database;

import org.cfdna.database.service.DuckDbService;
import org.cfdna.database.service.MafDuckDbImportService;
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

import static org.hamcrest.Matchers.containsString;
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
                .andExpect(jsonPath("$.data", hasSize(15)))
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
                .andExpect(jsonPath("$.data[4].cancer").value("Pancreatic"))
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

    @Test
    void tcgaGeneMutationDetailUsesExternalTcgaFileWithCancerType() throws Exception {
        mockMvc.perform(get("/api/v1/maf-mutations/genes/TP53/mutations")
                        .param("source", "TCGA")
                        .param("page", "1")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(2))
                .andExpect(jsonPath("$.data.content", hasSize(2)))
                .andExpect(jsonPath("$.data.content[0].cancerType").value("Bladder"))
                .andExpect(jsonPath("$.data.content[1].cancerType").value("Breast"));

        mockMvc.perform(get("/api/v1/maf-mutations/genes/TP53")
                        .param("source", "TCGA"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalVariants").value(2))
                .andExpect(jsonPath("$.data.totalSamples").value(2))
                .andExpect(jsonPath("$.data.cancerTypesPreview", containsString("Bladder")))
                .andExpect(jsonPath("$.data.cancerTypesPreview", containsString("Breast")));
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
            Path panCancerDir = TEST_DATA_DIR.resolve("statistics").resolve("oncoplot").resolve("pan_cancer");
            MafDuckDbImportService importService = new MafDuckDbImportService(
                    TEST_DATA_DIR.toString(),
                    panCancerDir.toString(),
                    "cfdnadb.duckdb");
            importService.rebuildDatabase();
            return new DuckDbService(TEST_DATA_DIR, "cfdnadb.duckdb", TEST_DATA_DIR.resolve("tcga_maf.txt"), panCancerDir);
        }
    }

    private static Path createTestDataDir() {
        try {
            Path root = Files.createTempDirectory("cfdna-test-data");
            createMafInputs(root);
            createPanCancerInputs(root);
            createBreastData(root.resolve("Breast"));
            createLungData(root.resolve("Lung"));
            // create empty dirs for all remaining cancers
            for (String cancer : new String[]{
                    "Colorectal", "Liver", "Pancreatic", "Bladder", "Cervical",
                    "Endometrial", "Esophageal", "Gastric", "HeadAndNeck",
                    "Kidney", "Ovarian", "Thyroid", "NGY"}) {
                createEmptyCancer(root.resolve(cancer));
            }
            return root;
        } catch (IOException exception) {
            throw new RuntimeException("Failed to create test data", exception);
        }
    }

    private static void createMafInputs(Path root) throws IOException {
        Files.writeString(root.resolve("cfDNA_MAF_Mutations.tsv"),
                "Cancer_Type\tChromosome\tStart_Position\tEnd_Position\tReference_Allele\tTumor_Seq_Allele2\tTumor_Sample_Barcode\tHugo_Symbol\tVariant_Classification\ttx\texon\ttxChange\taaChange\tVariant_Type\tFunc.refGene\tGene.refGene\tGeneDetail.refGene\tExonicFunc.refGene\tAAChange.refGene\tLocation\n" +
                        "Breast\tchr17\t7579472\t7579472\tC\tT\tBR-001\tTP53\tMissense_Mutation\t\t\t\t\tSNP\texonic\tTP53\t\tnonsynonymous SNV\tTP53:p.R175H\tchr17:7579472\n" +
                        "Breast\tchr12\t25245350\t25245350\tG\tA\tBR-002\tKRAS\tMissense_Mutation\t\t\t\t\tSNP\texonic\tKRAS\t\tnonsynonymous SNV\tKRAS:p.G12D\tchr12:25245350\n");
        Files.writeString(root.resolve("TCGA_maf_mutation.tsv"),
                "Hugo_Symbol\tChromosome\tStart_Position\tEnd_Position\tReference_Allele\tTumor_Seq_Allele2\tTumor_Sample_Barcode\tVariant_Classification\tVariant_Type\n" +
                        "TP53\tchr17\t7579472\t7579472\tC\tT\tTCGA-BR-01\tMissense_Mutation\tSNP\n");
        Files.writeString(root.resolve("tcga_maf.txt"),
                "Chromosome\tStart_Position\tEnd_Position\tReference_Allele\tTumor_Seq_Allele2\tTumor_Sample_Barcode\tHugo_Symbol\tVariant_Classification\tVariant_Type\tcancer_type\n" +
                        "17\t7579472\t7579472\tC\tT\tTCGA-BL-01\tTP53\tMissense_Mutation\tSNP\tTCGA_BLCA\n" +
                        "17\t7578406\t7578406\tG\tA\tTCGA-BR-01\tTP53\tNonsense_Mutation\tSNP\tTCGA_BRCA\n");
    }

    private static void createPanCancerInputs(Path root) throws IOException {
        Path panCancerDir = root.resolve("statistics").resolve("oncoplot").resolve("pan_cancer");
        Files.createDirectories(panCancerDir);
        Files.writeString(panCancerDir.resolve("clinical_data.txt"),
                "Tumor_Sample_Barcode\tCancerType\n" +
                        "BR-001\tCFDNA_Breast\n" +
                        "BR-002\tCFDNA_Breast\n");
        Files.writeString(panCancerDir.resolve("mutations_data.txt"),
                "Hugo_Symbol\tTumor_Sample_Barcode\tVariant_Classification\n" +
                        "TP53\tBR-001\tMissense_Mutation\n" +
                        "KRAS\tBR-002\tMissense_Mutation\n");
    }

    private static void createBreastData(Path cancerDir) throws IOException {
        Files.createDirectories(cancerDir.resolve("private/avinput"));
        Files.createDirectories(cancerDir.resolve("private/vcf"));
        Files.createDirectories(cancerDir.resolve("private/multianno"));
        Files.createDirectories(cancerDir.resolve("private/stats/lollipop"));
        Files.createDirectories(cancerDir.resolve("public/vcf"));
        Files.createDirectories(cancerDir.resolve("public/multianno"));
        Files.createDirectories(cancerDir.resolve("public/stats"));
        Files.createDirectories(cancerDir.resolve("tcga/stats"));
        Files.createDirectories(cancerDir.resolve("stats"));

        Files.writeString(cancerDir.resolve("private/avinput/BR-001.avinput"), "sample");
        Files.writeString(cancerDir.resolve("private/avinput/BR-002.avinput"), "sample");
        Files.writeString(cancerDir.resolve("private/vcf/BR-001.filtered.vcf.gz"), "vcf");
        Files.writeString(cancerDir.resolve("private/vcf/BR-002.filtered.vcf.gz"), "vcf");
        Files.writeString(cancerDir.resolve("private/multianno/BR-001.hg38_multianno.txt"), "anno");
        Files.writeString(cancerDir.resolve("private/multianno/BR-002.hg38_multianno.txt"), "anno");
        Files.writeString(cancerDir.resolve("private/stats/Breast_oncplot.pdf"), "%PDF-test");
        Files.writeString(cancerDir.resolve("tcga/stats/TCGA-BRCA-summary.pdf"), "%PDF-test");
        Files.writeString(cancerDir.resolve("Breast_all_sample_multianno.txt"),
                "Chr\tStart\tEnd\tRef\tAlt\tFunc.refGene\tGene.refGene\tExonicFunc.refGene\tAAChange.refGene\tTumor_Sample_Barcode\n" +
                        "chr17\t7579472\t7579472\tC\tT\texonic\tTP53\tnonsynonymous SNV\tTP53:p.R175H\tBR-001\n" +
                        "chr12\t25245350\t25245350\tG\tA\texonic\tKRAS\tnonsynonymous SNV\tKRAS:p.G12D\tBR-002\n" +
                        "chr17\t7578406\t7578406\tC\tT\texonic\tTP53;MDM2\tnonsynonymous SNV\tTP53:p.R248W\tBR-003\n");
    }

    private static void createLungData(Path cancerDir) throws IOException {
        Files.createDirectories(cancerDir.resolve("private/avinput"));
        Files.createDirectories(cancerDir.resolve("private/vcf"));
        Files.createDirectories(cancerDir.resolve("private/multianno"));
        Files.createDirectories(cancerDir.resolve("private/stats"));
        Files.createDirectories(cancerDir.resolve("public/vcf"));
        Files.createDirectories(cancerDir.resolve("public/stats"));
        Files.createDirectories(cancerDir.resolve("tcga/stats"));
        Files.createDirectories(cancerDir.resolve("stats"));

        Files.writeString(cancerDir.resolve("private/avinput/LU-001.avinput"), "sample");
        Files.writeString(cancerDir.resolve("private/vcf/LU-001.filtered.vcf.gz"), "vcf");
    }

    private static void createEmptyCancer(Path cancerDir) throws IOException {
        Files.createDirectories(cancerDir.resolve("private/avinput"));
        Files.createDirectories(cancerDir.resolve("private/vcf"));
        Files.createDirectories(cancerDir.resolve("private/multianno"));
        Files.createDirectories(cancerDir.resolve("private/stats/lollipop"));
        Files.createDirectories(cancerDir.resolve("public/vcf"));
        Files.createDirectories(cancerDir.resolve("public/multianno"));
        Files.createDirectories(cancerDir.resolve("public/stats/lollipop"));
        Files.createDirectories(cancerDir.resolve("tcga/stats"));
        Files.createDirectories(cancerDir.resolve("stats"));
    }
}
