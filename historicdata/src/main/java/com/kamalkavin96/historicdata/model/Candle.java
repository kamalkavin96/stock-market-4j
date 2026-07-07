package com.kamalkavin96.historicdata.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

/**
 * Mirrors the Python "Candle" pydantic model.
 * raw candle format from Groww: [timestampSeconds, open, high, low, close,
 * volume]
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Candle {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private ZonedDateTime timestamp;
    private Double open;
    private Double high;
    private Double low;
    private Double close;
    private Long volume;

    public Candle() {
    }

    public Candle(ZonedDateTime timestamp, Double open, Double high, Double low, Double close, Long volume) {
        this.timestamp = timestamp;
        this.open = open;
        this.high = high;
        this.low = low;
        this.close = close;
        this.volume = volume;
    }

    /**
     * Builds a Candle from a raw Groww candle array: [ts, open, high, low, close,
     * volume]
     */
    public static Candle fromRaw(List<Object> raw) {
        long epochSeconds = ((Number) raw.get(0)).longValue();
        ZonedDateTime istDateTime = Instant.ofEpochSecond(epochSeconds).atZone(IST);

        return new Candle(
                istDateTime,
                toDouble(raw.get(1)),
                toDouble(raw.get(2)),
                toDouble(raw.get(3)),
                toDouble(raw.get(4)),
                raw.get(5) == null ? null : ((Number) raw.get(5)).longValue());
    }

    private static Double toDouble(Object value) {
        return value == null ? null : ((Number) value).doubleValue();
    }

    // Getters / setters

    public ZonedDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(ZonedDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public Double getOpen() {
        return open;
    }

    public void setOpen(Double open) {
        this.open = open;
    }

    public Double getHigh() {
        return high;
    }

    public void setHigh(Double high) {
        this.high = high;
    }

    public Double getLow() {
        return low;
    }

    public void setLow(Double low) {
        this.low = low;
    }

    public Double getClose() {
        return close;
    }

    public void setClose(Double close) {
        this.close = close;
    }

    public Long getVolume() {
        return volume;
    }

    public void setVolume(Long volume) {
        this.volume = volume;
    }
}