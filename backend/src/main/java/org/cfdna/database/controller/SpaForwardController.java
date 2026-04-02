package org.cfdna.database.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaForwardController {

    @GetMapping({
            "/",
            "/browse",
            "/statistics",
            "/downloads",
            "/visualizations",
            "/about",
            "/vcf-demo",
            "/gene-search",
            "/gene-search/{geneSymbol}",
            "/mutation-analysis",
            "/charts",
            "/studies/{id}"
    })
    public String forwardToIndex() {
        return "forward:/index.html";
    }
}
