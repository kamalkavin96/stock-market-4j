package com.kamalkavin96.historicdata.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;

@JsonIgnoreProperties(ignoreUnknown = true)
public class Quote {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private Double close;
    private Double dayChange;
    private Double dayChangePerc;
    private Double high;
    private Double highPriceRange;
    private Double highTradeRange;
    private Long lastTradeQty;
    private Long lastTradeTime; // epoch seconds
    private Double low;
    private Double lowPriceRange;
    private Double lowTradeRange;
    private Double ltp;
    private Double oiDayChange;
    private Double oiDayChangePerc;
    private Double open;
    private Long openInterest;
    private Long prevOpenInterest;
    private String symbol;
    private Long totalBuyQty;
    private Long totalSellQty;
    private Long tsInMillis; // actually epoch seconds, despite the name
    private Long volume;
    private Double yearHighPrice;
    private Double yearLowPrice;
    private String type;

    // --- Derived, human-readable fields (output-only, not bound from JSON input)
    // ---

    @JsonProperty("lastTradeDateTime")
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss")
    public ZonedDateTime getLastTradeDateTime() {
        return lastTradeTime == null ? null : Instant.ofEpochSecond(lastTradeTime).atZone(IST);
    }

    @JsonProperty("quoteDateTime")
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss")
    public ZonedDateTime getQuoteDateTime() {
        return tsInMillis == null ? null : Instant.ofEpochSecond(tsInMillis).atZone(IST);
    }

    // --- Getters / setters ---

    public Double getClose() {
        return close;
    }

    public void setClose(Double close) {
        this.close = close;
    }

    public Double getDayChange() {
        return dayChange;
    }

    public void setDayChange(Double dayChange) {
        this.dayChange = dayChange;
    }

    public Double getDayChangePerc() {
        return dayChangePerc;
    }

    public void setDayChangePerc(Double dayChangePerc) {
        this.dayChangePerc = dayChangePerc;
    }

    public Double getHigh() {
        return high;
    }

    public void setHigh(Double high) {
        this.high = high;
    }

    public Double getHighPriceRange() {
        return highPriceRange;
    }

    public void setHighPriceRange(Double highPriceRange) {
        this.highPriceRange = highPriceRange;
    }

    public Double getHighTradeRange() {
        return highTradeRange;
    }

    public void setHighTradeRange(Double highTradeRange) {
        this.highTradeRange = highTradeRange;
    }

    public Long getLastTradeQty() {
        return lastTradeQty;
    }

    public void setLastTradeQty(Long lastTradeQty) {
        this.lastTradeQty = lastTradeQty;
    }

    public Long getLastTradeTime() {
        return lastTradeTime;
    }

    public void setLastTradeTime(Long lastTradeTime) {
        this.lastTradeTime = lastTradeTime;
    }

    public Double getLow() {
        return low;
    }

    public void setLow(Double low) {
        this.low = low;
    }

    public Double getLowPriceRange() {
        return lowPriceRange;
    }

    public void setLowPriceRange(Double lowPriceRange) {
        this.lowPriceRange = lowPriceRange;
    }

    public Double getLowTradeRange() {
        return lowTradeRange;
    }

    public void setLowTradeRange(Double lowTradeRange) {
        this.lowTradeRange = lowTradeRange;
    }

    public Double getLtp() {
        return ltp;
    }

    public void setLtp(Double ltp) {
        this.ltp = ltp;
    }

    public Double getOiDayChange() {
        return oiDayChange;
    }

    public void setOiDayChange(Double oiDayChange) {
        this.oiDayChange = oiDayChange;
    }

    public Double getOiDayChangePerc() {
        return oiDayChangePerc;
    }

    public void setOiDayChangePerc(Double oiDayChangePerc) {
        this.oiDayChangePerc = oiDayChangePerc;
    }

    public Double getOpen() {
        return open;
    }

    public void setOpen(Double open) {
        this.open = open;
    }

    public Long getOpenInterest() {
        return openInterest;
    }

    public void setOpenInterest(Long openInterest) {
        this.openInterest = openInterest;
    }

    public Long getPrevOpenInterest() {
        return prevOpenInterest;
    }

    public void setPrevOpenInterest(Long prevOpenInterest) {
        this.prevOpenInterest = prevOpenInterest;
    }

    public String getSymbol() {
        return symbol;
    }

    public void setSymbol(String symbol) {
        this.symbol = symbol;
    }

    public Long getTotalBuyQty() {
        return totalBuyQty;
    }

    public void setTotalBuyQty(Long totalBuyQty) {
        this.totalBuyQty = totalBuyQty;
    }

    public Long getTotalSellQty() {
        return totalSellQty;
    }

    public void setTotalSellQty(Long totalSellQty) {
        this.totalSellQty = totalSellQty;
    }

    public Long getTsInMillis() {
        return tsInMillis;
    }

    public void setTsInMillis(Long tsInMillis) {
        this.tsInMillis = tsInMillis;
    }

    public Long getVolume() {
        return volume;
    }

    public void setVolume(Long volume) {
        this.volume = volume;
    }

    public Double getYearHighPrice() {
        return yearHighPrice;
    }

    public void setYearHighPrice(Double yearHighPrice) {
        this.yearHighPrice = yearHighPrice;
    }

    public Double getYearLowPrice() {
        return yearLowPrice;
    }

    public void setYearLowPrice(Double yearLowPrice) {
        this.yearLowPrice = yearLowPrice;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }
}