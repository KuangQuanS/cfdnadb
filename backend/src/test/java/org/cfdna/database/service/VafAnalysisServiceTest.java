package org.cfdna.database.service;

import org.cfdna.database.dto.VafBodyMapDto;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class VafAnalysisServiceTest {

    @TempDir
    Path tempDir;

    @Test
    void bodyMapFindsCaseInsensitiveGeneFilesWithoutDirectoryRescan() throws IOException {
        writeGeneFile(
                tempDir.resolve("Breast").resolve("Private_cfDNA").resolve("VAF_results").resolve("gene").resolve("Tp53.txt"),
                "sample\tvaf\texonicFunc\n" +
                        "BR-001\t0.10\tnonsynonymous SNV\n" +
                        "BR-002\t0.30\tsynonymous SNV\n"
        );
        writeGeneFile(
                tempDir.resolve("Lung").resolve("Private_cfDNA").resolve("VAF_results").resolve("gene").resolve("tp53_exonic_vaf.txt"),
                "sample\tvaf\texonicFunc\n" +
                        "LU-001\t0.20\tframeshift deletion\n"
        );

        VafAnalysisService service = new VafAnalysisService(tempDir.toString());

        VafBodyMapDto result = service.getBodyMap("TP53");

        assertEquals("TP53", result.getGene());
        assertEquals(2, result.getEntries().size());
        assertFalse(result.getCancerTypeBoxplot().getGroups().isEmpty());
        assertFalse(result.getMutationTypeBoxplot().getGroups().isEmpty());
    }

    private static void writeGeneFile(Path path, String content) throws IOException {
        Files.createDirectories(path.getParent());
        Files.writeString(path, content);
    }
}
