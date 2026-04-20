package org.cfdna.database.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.cfdna.database.dto.GeneDescriptionDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GeneDescriptionService {

    private static final Logger log = LoggerFactory.getLogger(GeneDescriptionService.class);
    private static final String EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
    private static final String NCBI_GENE_URL = "https://www.ncbi.nlm.nih.gov/gene/";
    private static final Duration POSITIVE_TTL = Duration.ofDays(7);
    private static final Duration NEGATIVE_TTL = Duration.ofHours(1);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(6);

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();

    public GeneDescriptionService() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public Optional<GeneDescriptionDto> fetchBySymbol(String symbolRaw) {
        if (symbolRaw == null) {
            return Optional.empty();
        }
        String symbol = symbolRaw.trim();
        if (symbol.isEmpty()) {
            return Optional.empty();
        }
        String key = symbol.toUpperCase(Locale.ROOT);

        CacheEntry cached = cache.get(key);
        if (cached != null && !cached.isExpired()) {
            return Optional.ofNullable(cached.value);
        }

        try {
            Optional<String> geneId = resolveGeneId(symbol);
            if (geneId.isEmpty()) {
                cache.put(key, CacheEntry.miss());
                return Optional.empty();
            }
            Optional<GeneDescriptionDto> dto = fetchSummary(symbol, geneId.get());
            cache.put(key, dto.map(CacheEntry::hit).orElseGet(CacheEntry::miss));
            return dto;
        } catch (Exception exception) {
            log.warn("Failed to fetch NCBI gene summary for {}: {}", symbol, exception.getMessage());
            return Optional.empty();
        }
    }

    private Optional<String> resolveGeneId(String symbol) throws Exception {
        String term = URLEncoder.encode(symbol + "[Gene Symbol] AND human[Organism]", StandardCharsets.UTF_8);
        URI uri = URI.create(EUTILS_BASE + "/esearch.fcgi?db=gene&retmode=json&retmax=1&term=" + term);
        String body = httpGet(uri);
        JsonNode root = objectMapper.readTree(body);
        JsonNode idList = root.path("esearchresult").path("idlist");
        if (idList.isArray() && idList.size() > 0) {
            return Optional.of(idList.get(0).asText());
        }
        return Optional.empty();
    }

    private Optional<GeneDescriptionDto> fetchSummary(String symbol, String geneId) throws Exception {
        URI uri = URI.create(EUTILS_BASE + "/esummary.fcgi?db=gene&retmode=json&id=" + geneId);
        String body = httpGet(uri);
        JsonNode root = objectMapper.readTree(body);
        JsonNode record = root.path("result").path(geneId);
        if (record.isMissingNode() || record.isNull()) {
            return Optional.empty();
        }

        String name = textOrNull(record.path("description"));
        String summary = textOrNull(record.path("summary"));
        List<String> aliases = splitCsv(textOrNull(record.path("otheraliases")));
        String officialSymbol = firstNonBlank(textOrNull(record.path("name")), symbol);

        return Optional.of(new GeneDescriptionDto(
                officialSymbol,
                geneId,
                name,
                summary,
                aliases,
                NCBI_GENE_URL + geneId));
    }

    private String httpGet(URI uri) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(REQUEST_TIMEOUT)
                .header("Accept", "application/json")
                .GET()
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() / 100 != 2) {
            throw new IllegalStateException("NCBI request failed with status " + response.statusCode());
        }
        return response.body();
    }

    private static String textOrNull(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        String text = node.asText("").trim();
        return text.isEmpty() ? null : text;
    }

    private static String firstNonBlank(String a, String b) {
        return (a == null || a.isEmpty()) ? b : a;
    }

    private static List<String> splitCsv(String raw) {
        if (raw == null) {
            return List.of();
        }
        List<String> result = new ArrayList<>();
        for (String part : raw.split(",")) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) {
                result.add(trimmed);
            }
        }
        return List.copyOf(result);
    }

    private static final class CacheEntry {
        private final GeneDescriptionDto value;
        private final Instant expiresAt;

        private CacheEntry(GeneDescriptionDto value, Instant expiresAt) {
            this.value = value;
            this.expiresAt = expiresAt;
        }

        static CacheEntry hit(GeneDescriptionDto value) {
            return new CacheEntry(value, Instant.now().plus(POSITIVE_TTL));
        }

        static CacheEntry miss() {
            return new CacheEntry(null, Instant.now().plus(NEGATIVE_TTL));
        }

        boolean isExpired() {
            return Instant.now().isAfter(expiresAt);
        }
    }
}
