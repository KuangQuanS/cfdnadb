package org.cfdna.database.config;

import io.swagger.v3.oas.models.ExternalDocumentation;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI cfdnaOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("ctDNAdb API")
                        .description("Public API for the ctDNAdb academic database prototype.")
                        .version("v1")
                        .contact(new Contact().name("ctDNAdb Team")))
                .externalDocs(new ExternalDocumentation()
                        .description("Project notes")
                        .url("https://example.org/cfdna"));
    }
}
