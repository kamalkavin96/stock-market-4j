package com.kamalkavin96.historicdata.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.kamalkavin96.historicdata.model.Candle;
import com.kamalkavin96.historicdata.model.Quote;
import com.kamalkavin96.historicdata.service.GrowwService;

import io.swagger.v3.oas.annotations.Operation;

import java.util.List;

@RestController
@RequestMapping("/api/stocks")
public class StockController {

    private final GrowwService growwService;

    public StockController(GrowwService growwService) {
        this.growwService = growwService;
    }

    /**
     * GET /api/stocks/SBIN/history?period=50year&interval=1day
     * period: (n)day | (n)week | (n)month | (n)year e.g. 30day, 6month, 1year
     * interval: (n)min | (n)hour | (n)day | (n)week | (n)month | (n)year e.g. 5min,
     * 1day
     */
    @Operation(summary = "Get historical candles", description = "period e.g. 30day, 6month, 1year; interval e.g. 5min, 1hour, 1day")
    @GetMapping("/{symbol}/history")
    public ResponseEntity<List<Candle>> getHistory(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "1year") String period,
            @RequestParam(defaultValue = "1day") String interval) {
        List<Candle> candles = growwService.historyPrice(symbol, period, interval);
        return ResponseEntity.ok(candles);
    }

    /**
     * GET /api/stocks/SBIN/quotes
     */
    @GetMapping("/{symbol}/quotes")
    public ResponseEntity<Quote> getQuotes(@PathVariable String symbol) {
        return ResponseEntity.ok(growwService.getQuotes(symbol));
    }

    @GetMapping("/{symbol}/latest")
    public List<Quote> getLatest(
            @PathVariable String symbol,
            @RequestParam String interval,
            @RequestParam(defaultValue = "2") int limit) {
        return growwService.getLatestCandles(symbol, interval, limit);
    }
}