package com.kamalkavin96.historicdata.service;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import com.kamalkavin96.historicdata.model.Candle;
import com.kamalkavin96.historicdata.model.Quote;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class GrowwService {

    private static final String BASE_URL = "https://groww.in/v1/api";
    private static final Pattern PERIOD_PATTERN = Pattern.compile("^(\\d+)(day|week|month|year)$");
    private static final Pattern INTERVAL_PATTERN = Pattern.compile("^(\\d+)(min|hour|day|week|month|year)$");

    private static final Map<String, Integer> PERIOD_DAYS = Map.of(
            "day", 1,
            "week", 7,
            "month", 30,
            "year", 365);

    private static final Map<String, Integer> INTERVAL_MINUTES = Map.of(
            "min", 1,
            "hour", 60,
            "day", 1440,
            "week", 1440 * 7,
            "month", 1440 * 30,
            "year", 1440 * 365);

    private final RestTemplate restTemplate;

    public GrowwService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public Quote getQuotes(String symbol) {
        String url = String.format(
                "%s/stocks_data/v1/accord_points/exchange/NSE/segment/CASH/latest_prices_ohlc/%s",
                BASE_URL, symbol.toUpperCase());
        return restTemplate.getForObject(url, Quote.class);
    }

    /**
     * @param period   e.g. "50year", "30day", "6month"
     * @param interval e.g. "1day", "5min", "1hour"
     */
    public List<Candle> historyPrice(String symbol, String period, String interval) {
        long daysToSubtract = parsePeriodInDays(period);
        long intervalMinutes = parseIntervalInMinutes(interval);

        long endTimeMillis = Instant.now().toEpochMilli();
        long startTimeMillis = Instant.now().minusSeconds(daysToSubtract * 24 * 60 * 60).toEpochMilli();

        String url = UriComponentsBuilder
                .fromUriString(BASE_URL + "/charting_service/v2/chart/exchange/NSE/segment/CASH/{symbol}")
                .queryParam("startTimeInMillis", startTimeMillis)
                .queryParam("endTimeInMillis", endTimeMillis)
                .queryParam("intervalInMinutes", intervalMinutes)
                .buildAndExpand(symbol.toUpperCase())
                .toUriString();

        Map<String, Object> response;
        try {
            response = restTemplate.getForObject(url, Map.class);
        } catch (RestClientException e) {
            throw new IllegalStateException("Failed to fetch history from Groww for " + symbol, e);
        }

        if (response == null || response.get("candles") == null) {
            return List.of();
        }

        List<List<Object>> rawCandles = (List<List<Object>>) response.get("candles");
        return rawCandles.stream()
                .map(Candle::fromRaw)
                .collect(Collectors.toList());
    }

    private long parsePeriodInDays(String period) {
        Matcher matcher = PERIOD_PATTERN.matcher(period.trim().toLowerCase());
        if (!matcher.matches()) {
            throw new IllegalArgumentException(
                    "Invalid period format: " + period + " (expected e.g. 30day, 6month, 1year)");
        }
        int value = Integer.parseInt(matcher.group(1));
        String unit = matcher.group(2);
        return (long) value * PERIOD_DAYS.get(unit);
    }

    private long parseIntervalInMinutes(String interval) {
        Matcher matcher = INTERVAL_PATTERN.matcher(interval.trim().toLowerCase());
        if (!matcher.matches()) {
            throw new IllegalArgumentException(
                    "Invalid interval format: " + interval + " (expected e.g. 1min, 1hour, 1day)");
        }
        int value = Integer.parseInt(matcher.group(1));
        String unit = matcher.group(2);
        return (long) value * INTERVAL_MINUTES.get(unit);
    }
}
