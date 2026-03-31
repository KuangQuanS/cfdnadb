package org.cfdna.database;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OverviewControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void overviewEndpointReturnsSeededCounts() throws Exception {
        mockMvc.perform(get("/api/v1/overview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.studyCount").value(3))
                .andExpect(jsonPath("$.data.biomarkerCount").value(9));
    }

    @Test
    void recordsEndpointReturnsSeededRows() throws Exception {
        mockMvc.perform(get("/api/v1/records").param("page", "0").param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content.length()").value(9))
                .andExpect(jsonPath("$.data.totalElements").value(9));
    }
}
