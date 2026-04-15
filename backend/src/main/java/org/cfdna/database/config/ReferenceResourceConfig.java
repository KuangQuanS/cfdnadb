package org.cfdna.database.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Serves genome reference files (FASTA, index, cytoband) from the local
 * filesystem so IGV.js can load them via HTTP Range requests without hitting
 * external servers.
 *
 * Files expected in {@code ${app.data-dir}/reference/}:
 *   hg38.fa                      — plain FASTA (symlink from /400T/reference_genome/ is fine)
 *   hg38.fa.fai                  — samtools FASTA index
 *   hg38_cytoBandIdeo.txt.gz     — optional, chromosome band ideogram
 */
@Configuration
public class ReferenceResourceConfig implements WebMvcConfigurer {

    private final String dataDir;

    public ReferenceResourceConfig(
            @Value("${app.data-dir:/400T/cfdnaweb}") String dataDir) {
        this.dataDir = dataDir;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String referenceDir = dataDir.endsWith("/") ? dataDir : dataDir + "/";
        registry.addResourceHandler("/api/v1/reference/**")
                .addResourceLocations("file:" + referenceDir + "reference/")
                .setCachePeriod(86400); // 1 day — genome files never change
    }
}
