package org.cfdna.database.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaForwardController {

    @GetMapping({"/", "/browse", "/downloads", "/visualizations", "/about", "/vcf-demo", "/studies/{id}"})
    public String forwardToIndex() {
        return "forward:/index.html";
    }
}
