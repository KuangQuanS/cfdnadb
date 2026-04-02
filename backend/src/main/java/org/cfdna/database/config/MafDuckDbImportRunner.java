package org.cfdna.database.config;

import org.cfdna.database.service.MafDuckDbImportService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.stereotype.Component;

@Component
public class MafDuckDbImportRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(MafDuckDbImportRunner.class);

    private final MafDuckDbImportService importService;
    private final ConfigurableApplicationContext applicationContext;
    private final boolean enabled;
    private final boolean exitAfterRun;

    public MafDuckDbImportRunner(MafDuckDbImportService importService,
                                 ConfigurableApplicationContext applicationContext,
                                 @Value("${app.maf-import.enabled:false}") boolean enabled,
                                 @Value("${app.maf-import.exit-after-run:true}") boolean exitAfterRun) {
        this.importService = importService;
        this.applicationContext = applicationContext;
        this.enabled = enabled;
        this.exitAfterRun = exitAfterRun;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            return;
        }

        log.info("[MAF-IMPORT] startup import requested");
        importService.rebuildDatabase();

        if (exitAfterRun) {
            log.info("[MAF-IMPORT] exiting after import");
            int exitCode = SpringApplication.exit(applicationContext, () -> 0);
            System.exit(exitCode);
        }
    }
}
