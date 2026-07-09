import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
    createChart,
    ColorType,
    CandlestickSeries,
    HistogramSeries,
    LineSeries,
    CrosshairMode,
    LineStyle,
    type UTCTimestamp,
    type IChartApi,
    type ISeriesApi,
    type MouseEventParams,
} from "lightweight-charts";

import stockService from "../../services/stockService";
import * as ind from "./indicators";
import type { Candle } from "./indicators";
import {
    IconFit, IconReset, IconSun, IconMoon, IconExpand, IconCollapse,
    IconDownload, IconPlus, IconClose, IconChevronDown, IconActivity,
} from "./icons";

interface Props {
    symbol: string;
    period?: string;
    interval?: string;
    onPeriodChange?: (period: string) => void;
    onIntervalChange?: (interval: string) => void;
}

/* ============================================================
   PERIOD / INTERVAL — single source of truth. Backend contract
   uses your existing word-based keys (day/week/month/year etc).
   ============================================================ */
const PERIOD_OPTIONS = [
    { value: "1day", label: "1D" },
    { value: "5day", label: "5D" },
    { value: "1month", label: "1M" },
    { value: "3month", label: "3M" },
    { value: "6month", label: "6M" },
    { value: "1year", label: "1Y" },
    { value: "2year", label: "2Y" },
    { value: "5year", label: "5Y" },
    { value: "10year", label: "10Y" },
    { value: "40year", label: "All" },
] as const;

const INTERVAL_OPTIONS = [
    { value: "1min", label: "1m" },
    { value: "3min", label: "3m" },
    { value: "5min", label: "5m" },
    { value: "15min", label: "15m" },
    { value: "30min", label: "30m" },
    { value: "1hour", label: "1h" },
    { value: "2hour", label: "2h" },
    { value: "4hour", label: "4h" },
    { value: "1day", label: "1D" },
    { value: "1week", label: "1W" },
    { value: "1month", label: "1M" },
] as const;

// Derived, never hand-typed — guarantees the default always exists in the list
// and the two never drift apart again.
const DEFAULT_PERIOD = PERIOD_OPTIONS[3].value;   // "3month"
const DEFAULT_INTERVAL = INTERVAL_OPTIONS[8].value; // "1day"

// Poll cadence scales with the selected interval — no point polling every
// 5s on a 1-month interval chart.
const LIVE_POLL_MS: Record<string, number> = {
    "1min": 5_000, "3min": 8_000, "5min": 10_000, "15min": 20_000,
    "30min": 30_000, "1hour": 60_000, "2hour": 90_000, "4hour": 120_000,
    "1day": 300_000, "1week": 600_000, "1month": 900_000,
};

/* ============================================================
   Design tokens
   ============================================================ */
const THEME = {
    light: {
        background: "#ffffff", surface: "#fbfbfc", surfaceRaised: "#ffffff",
        text: "#131722", textMuted: "#6b7280", grid: "#eceef1", border: "#e2e5eb",
        borderStrong: "#d1d4dc", up: "#26a69a", down: "#ef5350",
        volumeUp: "rgba(38, 166, 154, 0.5)", volumeDown: "rgba(239, 83, 80, 0.5)",
        crosshair: "#9598a1", accent: "#2962ff", accentSoft: "rgba(41,98,255,0.1)",
        chipBg: "#f2f3f6", menuBg: "#ffffff", menuHover: "#f2f4f8",
        shadow: "0 8px 24px rgba(19,23,34,0.08)", live: "#26a69a",
    },
    dark: {
        background: "#0e1117", surface: "#131722", surfaceRaised: "#161a24",
        text: "#d1d4dc", textMuted: "#7d8494", grid: "#1b1f2b", border: "#232733",
        borderStrong: "#2a2e39", up: "#26a69a", down: "#ef5350",
        volumeUp: "rgba(38, 166, 154, 0.5)", volumeDown: "rgba(239, 83, 80, 0.5)",
        crosshair: "#5d626e", accent: "#5b8cff", accentSoft: "rgba(91,140,255,0.15)",
        chipBg: "#1a1e2a", menuBg: "#171b26", menuHover: "#1f2431",
        shadow: "0 8px 28px rgba(0,0,0,0.45)", live: "#3ddc97",
    },
};
type ThemeT = typeof THEME.light;

const PALETTE = ["#2962ff", "#ff6d00", "#7e57c2", "#00897b", "#d81b60", "#ffb300", "#00acc1", "#8e24aa"];

/* ============================================================
   Indicator model
   ============================================================ */
type IndicatorType =
    | "SMA" | "EMA" | "WMA" | "BB" | "VWAP"
    | "RSI" | "MACD" | "STOCH" | "ATR" | "CCI" | "WILLR" | "MOM" | "ROC";

interface IndicatorMeta { type: IndicatorType; label: string; short: string; category: "overlay" | "oscillator"; }

const AVAILABLE_INDICATORS: IndicatorMeta[] = [
    { type: "SMA", label: "Simple Moving Average", short: "SMA", category: "overlay" },
    { type: "EMA", label: "Exponential Moving Average", short: "EMA", category: "overlay" },
    { type: "WMA", label: "Weighted Moving Average", short: "WMA", category: "overlay" },
    { type: "BB", label: "Bollinger Bands", short: "BB", category: "overlay" },
    { type: "VWAP", label: "Volume Weighted Average Price", short: "VWAP", category: "overlay" },
    { type: "RSI", label: "Relative Strength Index", short: "RSI", category: "oscillator" },
    { type: "MACD", label: "MACD", short: "MACD", category: "oscillator" },
    { type: "STOCH", label: "Stochastic Oscillator", short: "Stoch", category: "oscillator" },
    { type: "ATR", label: "Average True Range", short: "ATR", category: "oscillator" },
    { type: "CCI", label: "Commodity Channel Index", short: "CCI", category: "oscillator" },
    { type: "WILLR", label: "Williams %R", short: "%R", category: "oscillator" },
    { type: "MOM", label: "Momentum", short: "MOM", category: "oscillator" },
    { type: "ROC", label: "Rate of Change", short: "ROC", category: "oscillator" },
];

interface ActiveIndicator {
    id: string; type: IndicatorType; color: string; paneIndex: number;
    length: number; stdDev?: number; fast?: number; slow?: number;
    signalLength?: number; kPeriod?: number; dPeriod?: number;
}

function defaultParamsFor(type: IndicatorType): Omit<ActiveIndicator, "id" | "color" | "paneIndex"> {
    switch (type) {
        case "SMA": return { length: 20 };
        case "EMA": return { length: 50 };
        case "WMA": return { length: 20 };
        case "BB": return { length: 20, stdDev: 2 };
        case "VWAP": return { length: 0 };
        case "RSI": return { length: 14 };
        case "MACD": return { length: 0, fast: 12, slow: 26, signalLength: 9 };
        case "STOCH": return { length: 0, kPeriod: 14, dPeriod: 3 };
        case "ATR": return { length: 14 };
        case "CCI": return { length: 20 };
        case "WILLR": return { length: 14 };
        case "MOM": return { length: 10 };
        case "ROC": return { length: 10 };
    }
}

interface OhlcLegend {
    open: number; high: number; low: number; close: number; volume: number;
    time: string; changePct: number;
}

/* ============================================================
   Component
   ============================================================ */
export default function CandlestickChart({
    symbol,
    period: periodProp,
    interval: intervalProp,
    onPeriodChange,
    onIntervalChange,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartWrapperRef = useRef<HTMLDivElement>(null);
    const chartApiRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const candleDataRef = useRef<Candle[]>([]);
    const lastCandleRef = useRef<OhlcLegend | null>(null);
    const seriesMapRef = useRef<Record<string, ISeriesApi<any>[]>>({});
    const priceLinesRef = useRef<Record<string, any[]>>({});
    const paneCounterRef = useRef(1); // pane 0 = main chart
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [periodState, setPeriodState] = useState(periodProp ?? DEFAULT_PERIOD);
    const [intervalState, setIntervalState] = useState(intervalProp ?? DEFAULT_INTERVAL);
    const period = periodProp ?? periodState;
    const interval = intervalProp ?? intervalState;

    const [isDark, setIsDark] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [legend, setLegend] = useState<OhlcLegend | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLive, setIsLive] = useState(false);

    const [activeIndicators, setActiveIndicators] = useState<ActiveIndicator[]>([]);
    const [menuOpen, setMenuOpen] = useState(false);

    const theme = useMemo(() => (isDark ? THEME.dark : THEME.light), [isDark]);

    const handlePeriodChange = (value: string) => {
        if (!periodProp) setPeriodState(value);
        onPeriodChange?.(value);
    };
    const handleIntervalChange = (value: string) => {
        if (!intervalProp) setIntervalState(value);
        onIntervalChange?.(value);
    };

    /* ---- Build chart once ---- */
    useEffect(() => {
        if (!containerRef.current) return;

        const chart = createChart(containerRef.current, {
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
            layout: { background: { type: ColorType.Solid, color: theme.background }, textColor: theme.text, attributionLogo: false },
            grid: { vertLines: { color: theme.grid }, horzLines: { color: theme.grid } },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: { color: theme.crosshair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: theme.crosshair },
                horzLine: { color: theme.crosshair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: theme.crosshair },
            },
            rightPriceScale: { borderColor: theme.border, scaleMargins: { top: 0.08, bottom: 0.28 } },
            timeScale: { borderColor: theme.border, timeVisible: true, secondsVisible: false, rightOffset: 6, barSpacing: 7 },
            handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
            handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
        });

        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: theme.up, downColor: theme.down, borderUpColor: theme.up, borderDownColor: theme.down,
            wickUpColor: theme.up, wickDownColor: theme.down, priceLineVisible: true, lastValueVisible: true,
        });

        const volumeSeries = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "volume" });
        chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });

        chart.subscribeCrosshairMove((param: MouseEventParams) => {
            if (!param.time || !param.seriesData.size) { setLegend(lastCandleRef.current); return; }
            const candle = param.seriesData.get(candleSeries) as any;
            const vol = param.seriesData.get(volumeSeries) as any;
            if (!candle) return;
            const changePct = candle.open !== 0 ? ((candle.close - candle.open) / candle.open) * 100 : 0;
            setLegend({
                open: candle.open, high: candle.high, low: candle.low, close: candle.close,
                volume: vol?.value ?? 0,
                time: new Date((param.time as number) * 1000).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
                changePct,
            });
        });

        chartApiRef.current = chart;
        candleSeriesRef.current = candleSeries;
        volumeSeriesRef.current = volumeSeries;

        const resizeObserver = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) chart.applyOptions({ width, height });
        });
        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.remove();
            chartApiRef.current = null;
            candleSeriesRef.current = null;
            volumeSeriesRef.current = null;
            seriesMapRef.current = {};
            priceLinesRef.current = {};
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ---- Theme updates (candles, grid, and every existing series/priceLine) ---- */
    useEffect(() => {
        const chart = chartApiRef.current;
        const candle = candleSeriesRef.current;
        if (!chart || !candle) return;

        chart.applyOptions({
            layout: { background: { type: ColorType.Solid, color: theme.background }, textColor: theme.text },
            grid: { vertLines: { color: theme.grid }, horzLines: { color: theme.grid } },
            rightPriceScale: { borderColor: theme.border },
            timeScale: { borderColor: theme.border },
            crosshair: {
                vertLine: { color: theme.crosshair, labelBackgroundColor: theme.crosshair },
                horzLine: { color: theme.crosshair, labelBackgroundColor: theme.crosshair },
            },
        });

        candle.applyOptions({
            upColor: theme.up, downColor: theme.down, borderUpColor: theme.up, borderDownColor: theme.down,
            wickUpColor: theme.up, wickDownColor: theme.down,
        });

        // Redraw RSI 70/30 bands etc. with the new border color (bug fix:
        // these used to stay stale after a theme toggle).
        Object.entries(priceLinesRef.current).forEach(([id, lines]) => {
            const series = seriesMapRef.current[id]?.[0];
            if (!series) return;
            lines.forEach((l) => series.removePriceLine(l));
            const created: any[] = [];
            const ind = activeIndicators.find((i) => i.id === id);
            if (ind?.type === "RSI") {
                created.push(series.createPriceLine({ price: 70, color: theme.borderStrong, lineStyle: LineStyle.Dotted, lineWidth: 1, axisLabelVisible: true, title: "70" }));
                created.push(series.createPriceLine({ price: 30, color: theme.borderStrong, lineStyle: LineStyle.Dotted, lineWidth: 1, axisLabelVisible: true, title: "30" }));
            }
            priceLinesRef.current[id] = created;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDark]);

    /* ---- Create/remove series when the set of active indicators changes ---- */
    const createSeriesFor = useCallback((indz: ActiveIndicator): ISeriesApi<any>[] => {
        const chart = chartApiRef.current;
        if (!chart) return [];
        const lineOpts = (color: string, dashed = false) => ({
            color, lineWidth: 2 as const, priceLineVisible: false, lastValueVisible: false,
            crosshairMarkerVisible: false, lineStyle: dashed ? LineStyle.Dashed : LineStyle.Solid,
        });

        switch (indz.type) {
            case "SMA": case "EMA": case "WMA": case "VWAP":
                return [chart.addSeries(LineSeries, lineOpts(indz.color), 0)];
            case "BB": {
                const upper = chart.addSeries(LineSeries, lineOpts(indz.color), 0);
                const mid = chart.addSeries(LineSeries, lineOpts(indz.color, true), 0);
                const lower = chart.addSeries(LineSeries, lineOpts(indz.color), 0);
                return [upper, mid, lower];
            }
            case "RSI": case "ATR": case "CCI": case "WILLR": case "MOM": case "ROC": {
                const s = chart.addSeries(LineSeries, lineOpts(indz.color), indz.paneIndex);
                if (indz.type === "RSI") {
                    priceLinesRef.current[indz.id] = [
                        s.createPriceLine({ price: 70, color: theme.borderStrong, lineStyle: LineStyle.Dotted, lineWidth: 1, axisLabelVisible: true, title: "70" }),
                        s.createPriceLine({ price: 30, color: theme.borderStrong, lineStyle: LineStyle.Dotted, lineWidth: 1, axisLabelVisible: true, title: "30" }),
                    ];
                }
                return [s];
            }
            case "MACD": {
                const macdLine = chart.addSeries(LineSeries, lineOpts(indz.color), indz.paneIndex);
                const signalLine = chart.addSeries(LineSeries, lineOpts(PALETTE[(PALETTE.indexOf(indz.color) + 2) % PALETTE.length]), indz.paneIndex);
                const hist = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, indz.paneIndex);
                return [macdLine, signalLine, hist];
            }
            case "STOCH": {
                const k = chart.addSeries(LineSeries, lineOpts(indz.color), indz.paneIndex);
                const d = chart.addSeries(LineSeries, lineOpts(PALETTE[(PALETTE.indexOf(indz.color) + 2) % PALETTE.length]), indz.paneIndex);
                return [k, d];
            }
        }
    }, [theme.borderStrong]);

    const recomputeIndicator = useCallback((indz: ActiveIndicator) => {
        const data = candleDataRef.current;
        const series = seriesMapRef.current[indz.id];
        if (!data.length || !series) return;

        switch (indz.type) {
            case "SMA": series[0].setData(ind.sma(data, indz.length)); break;
            case "EMA": series[0].setData(ind.ema(data, indz.length)); break;
            case "WMA": series[0].setData(ind.wma(data, indz.length)); break;
            case "VWAP": series[0].setData(ind.vwap(data)); break;
            case "BB": {
                const { upper, mid, lower } = ind.bollinger(data, indz.length, indz.stdDev ?? 2);
                series[0].setData(upper); series[1].setData(mid); series[2].setData(lower);
                break;
            }
            case "RSI": series[0].setData(ind.rsi(data, indz.length)); break;
            case "ATR": series[0].setData(ind.atr(data, indz.length)); break;
            case "CCI": series[0].setData(ind.cci(data, indz.length)); break;
            case "WILLR": series[0].setData(ind.williamsR(data, indz.length)); break;
            case "MOM": series[0].setData(ind.momentum(data, indz.length)); break;
            case "ROC": series[0].setData(ind.roc(data, indz.length)); break;
            case "MACD": {
                const { macd: m, signal, histogram } = ind.macd(data, indz.fast ?? 12, indz.slow ?? 26, indz.signalLength ?? 9);
                series[0].setData(m); series[1].setData(signal);
                (series[2] as ISeriesApi<"Histogram">).setData(histogram);
                break;
            }
            case "STOCH": {
                const { k, d } = ind.stochastic(data, indz.kPeriod ?? 14, indz.dPeriod ?? 3);
                series[0].setData(k); series[1].setData(d);
                break;
            }
        }
    }, []);

    const recomputeAll = useCallback(() => {
        activeIndicators.forEach(recomputeIndicator);
    }, [activeIndicators, recomputeIndicator]);

    const indicatorSignature = activeIndicators
        .map((i) => `${i.id}:${i.length}:${i.stdDev}:${i.fast}:${i.slow}:${i.signalLength}:${i.kPeriod}:${i.dPeriod}`)
        .join("|");

    useEffect(() => {
        const chart = chartApiRef.current;
        if (!chart) return;
        const currentIds = new Set(activeIndicators.map((i) => i.id));

        Object.keys(seriesMapRef.current).forEach((id) => {
            if (!currentIds.has(id)) {
                seriesMapRef.current[id].forEach((s) => { try { chart.removeSeries(s); } catch { /* already gone */ } });
                delete seriesMapRef.current[id];
                delete priceLinesRef.current[id];
            }
        });

        activeIndicators.forEach((indz) => {
            if (!seriesMapRef.current[indz.id]) seriesMapRef.current[indz.id] = createSeriesFor(indz);
        });

        recomputeAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [indicatorSignature, createSeriesFor]);

    /* ---- Full reload on symbol/period/interval change ---- */
    const loadData = useCallback(async () => {
        const candle = candleSeriesRef.current;
        const volume = volumeSeriesRef.current;
        if (!candle || !volume || !period || !interval) return;

        setLoading(true);
        setError(null);
        candleDataRef.current = [];
        lastCandleRef.current = null;
        setLegend(null);

        try {
            const raw = await stockService.getHistory(symbol, period, interval);

            if (!raw || raw.length === 0) {
                candle.setData([]); volume.setData([]);
                setError("No data returned for this symbol/period/interval combination.");
                return;
            }

            const seen = new Set<number>();
            const candles: Candle[] = raw
                .map((item) => ({
                    time: Math.floor(new Date(item.timestamp).getTime() / 1000) as UTCTimestamp,
                    open: item.open, high: item.high, low: item.low, close: item.close, volume: item.volume ?? 0,
                }))
                .filter((c) => (seen.has(c.time) ? false : (seen.add(c.time), true)))
                .sort((a, b) => a.time - b.time);

            candleDataRef.current = candles;
            candle.setData(candles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
            volume.setData(candles.map((c) => ({
                time: c.time, value: c.volume, color: c.close >= c.open ? theme.volumeUp : theme.volumeDown,
            })));

            recomputeAll();

            const last = candles[candles.length - 1];
            const changePct = last.open !== 0 ? ((last.close - last.open) / last.open) * 100 : 0;
            const lastLegend: OhlcLegend = {
                open: last.open, high: last.high, low: last.low, close: last.close, volume: last.volume,
                time: new Date(last.time * 1000).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
                changePct,
            };
            lastCandleRef.current = lastLegend;
            setLegend(lastLegend);
            chartApiRef.current?.timeScale().fitContent();
        } catch (err) {
            console.error("Failed to load history:", err);
            setError("Failed to load chart data. Please try again.");
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol, period, interval, theme.volumeUp, theme.volumeDown]);

    useEffect(() => { loadData(); }, [loadData]);

    /* ---- Live mode: poll only the newest candle(s), patch in-place ---- */
    const pollLatest = useCallback(async () => {
        const candle = candleSeriesRef.current;
        const volume = volumeSeriesRef.current;
        if (!candle || !volume) return;

        try {
            const raw = await stockService.getLatest(symbol, interval);
            if (!raw || raw.length === 0) return;

            const incoming: Candle[] = raw.map((item) => ({
                time: Math.floor(new Date(item.timestamp).getTime() / 1000) as UTCTimestamp,
                open: item.open, high: item.high, low: item.low, close: item.close, volume: item.volume ?? 0,
            }));

            const data = candleDataRef.current;
            let changed = false;

            for (const bar of incoming) {
                const lastIdx = data.length - 1;
                if (lastIdx >= 0 && data[lastIdx].time === bar.time) {
                    data[lastIdx] = bar; // same bar still forming — patch it
                } else if (lastIdx < 0 || bar.time > data[lastIdx].time) {
                    data.push(bar); // a new bar opened
                } else {
                    continue; // stale/out-of-order — ignore
                }
                changed = true;
                candle.update({ time: bar.time, open: bar.open, high: bar.high, low: bar.low, close: bar.close });
                volume.update({ time: bar.time, value: bar.volume, color: bar.close >= bar.open ? theme.volumeUp : theme.volumeDown });
            }

            if (changed) {
                recomputeAll();
                const last = data[data.length - 1];
                const changePct = last.open !== 0 ? ((last.close - last.open) / last.open) * 100 : 0;
                const lastLegend: OhlcLegend = {
                    open: last.open, high: last.high, low: last.low, close: last.close, volume: last.volume,
                    time: new Date(last.time * 1000).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
                    changePct,
                };
                lastCandleRef.current = lastLegend;
                setLegend((prev) => (prev ? lastLegend : prev)); // don't override crosshair hover state
            }
        } catch (err) {
            console.error("Live poll failed:", err);
        }
    }, [symbol, interval, theme.volumeUp, theme.volumeDown, recomputeAll]);

    useEffect(() => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (!isLive) return;
        const ms = LIVE_POLL_MS[interval] ?? 15_000;
        pollRef.current = setInterval(pollLatest, ms);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [isLive, interval, pollLatest]);

    // Live mode should switch off automatically if the user changes symbol/period —
    // resuming on stale assumptions would silently poll the wrong thing.
    useEffect(() => { setIsLive(false); }, [symbol, period]);

    const handleFitContent = () => chartApiRef.current?.timeScale().fitContent();
    const handleResetZoom = () => chartApiRef.current?.timeScale().resetTimeScale();

    const toggleFullscreen = () => {
        const el = chartWrapperRef.current;
        if (!el) return;
        if (!document.fullscreenElement) { el.requestFullscreen(); setIsFullscreen(true); }
        else { document.exitFullscreen(); setIsFullscreen(false); }
    };

    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", handler);
        return () => document.removeEventListener("fullscreenchange", handler);
    }, []);

    const handleScreenshot = () => {
        const chart = chartApiRef.current;
        if (!chart) return;
        const canvas = chart.takeScreenshot();
        const safe = (s: string) => s.replace(/[^a-z0-9_-]/gi, "_");
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = `${safe(symbol)}_${safe(period)}_${safe(interval)}.png`;
        link.click();
    };

    const addIndicator = (type: IndicatorType) => {
        const meta = AVAILABLE_INDICATORS.find((a) => a.type === type)!;
        const id = `${type}-${Date.now()}`;
        const color = PALETTE[activeIndicators.length % PALETTE.length];
        const paneIndex = meta.category === "oscillator" ? paneCounterRef.current++ : 0;
        setActiveIndicators((prev) => [...prev, { id, type, color, paneIndex, ...defaultParamsFor(type) }]);
        setMenuOpen(false);
    };
    const removeIndicator = (id: string) => setActiveIndicators((prev) => prev.filter((i) => i.id !== id));
    const updateIndicator = (id: string, patch: Partial<ActiveIndicator>) =>
        setActiveIndicators((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

    return (
        <div
            ref={chartWrapperRef}
            style={{
                display: "flex", flexDirection: "column", width: "100%",
                height: isFullscreen ? "100vh" : "720px",
                background: theme.background, border: `1px solid ${theme.border}`,
                borderRadius: 10, overflow: "hidden",
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                boxShadow: theme.shadow,
            }}
        >
            {/* Toolbar row 1 */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                padding: "10px 14px", background: theme.surface, borderBottom: `1px solid ${theme.border}`, flexWrap: "wrap",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <SelectField theme={theme} label="Period" value={period} onChange={handlePeriodChange} options={PERIOD_OPTIONS} />
                    <SelectField theme={theme} label="Interval" value={interval} onChange={handleIntervalChange} options={INTERVAL_OPTIONS} />

                    <div style={{ position: "relative" }}>
                        <button onClick={() => setMenuOpen((v) => !v)} style={toolbarBtnStyle(theme)}>
                            <IconPlus size={13} /> Indicator <IconChevronDown size={12} />
                        </button>
                        {menuOpen && (
                            <>
                                <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
                                <div style={{
                                    position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 11,
                                    background: theme.menuBg, border: `1px solid ${theme.border}`, borderRadius: 8,
                                    boxShadow: theme.shadow, minWidth: 240, overflow: "hidden", padding: 4,
                                }}>
                                    <MenuSection title="Overlays" theme={theme} />
                                    {AVAILABLE_INDICATORS.filter((m) => m.category === "overlay").map((meta) => (
                                        <MenuItem key={meta.type} theme={theme} label={meta.label} onClick={() => addIndicator(meta.type)} />
                                    ))}
                                    <MenuSection title="Oscillators" theme={theme} />
                                    {AVAILABLE_INDICATORS.filter((m) => m.category === "oscillator").map((meta) => (
                                        <MenuItem key={meta.type} theme={theme} label={meta.label} onClick={() => addIndicator(meta.type)} />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    <button
                        onClick={() => setIsLive((v) => !v)}
                        style={{
                            ...toolbarBtnStyle(theme),
                            background: isLive ? theme.accentSoft : "transparent",
                            color: isLive ? theme.accent : theme.text,
                            borderColor: isLive ? theme.accent : theme.border,
                        }}
                        title={isLive ? "Live updates on — polling latest candle" : "Enable live updates"}
                    >
                        <span style={{
                            width: 7, height: 7, borderRadius: "50%",
                            background: isLive ? theme.live : theme.textMuted,
                            boxShadow: isLive ? `0 0 0 3px ${theme.accentSoft}` : "none",
                            display: "inline-block",
                        }} />
                        Live
                    </button>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                    <IconBtn theme={theme} title="Download PNG" onClick={handleScreenshot}><IconDownload /></IconBtn>
                    <IconBtn theme={theme} title="Fit content" onClick={handleFitContent}><IconFit /></IconBtn>
                    <IconBtn theme={theme} title="Reset zoom" onClick={handleResetZoom}><IconReset /></IconBtn>
                    <IconBtn theme={theme} title="Toggle theme" onClick={() => setIsDark((d) => !d)}>{isDark ? <IconSun /> : <IconMoon />}</IconBtn>
                    <IconBtn theme={theme} title="Fullscreen" onClick={toggleFullscreen}>{isFullscreen ? <IconCollapse /> : <IconExpand />}</IconBtn>
                </div>
            </div>

            {/* Toolbar row 2: indicator chips */}
            {activeIndicators.length > 0 && (
                <div style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                    background: theme.surface, borderBottom: `1px solid ${theme.border}`, flexWrap: "wrap",
                }}>
                    {activeIndicators.map((iv) => (
                        <IndicatorChip key={iv.id} theme={theme} indicator={iv} onUpdate={updateIndicator} onRemove={removeIndicator} />
                    ))}
                </div>
            )}

            {/* Legend + chart */}
            <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
                {legend && (
                    <div style={{
                        position: "absolute", top: 10, left: 14, zIndex: 2, fontSize: 12, color: theme.text,
                        pointerEvents: "none", display: "flex", gap: 12, flexWrap: "wrap",
                        maxWidth: "calc(100% - 28px)", alignItems: "center",
                    }}>
                        <span style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                            <IconActivity size={13} /> {symbol}
                        </span>
                        <LegendField label="O" value={legend.open} />
                        <LegendField label="H" value={legend.high} />
                        <LegendField label="L" value={legend.low} />
                        <LegendField label="C" value={legend.close} />
                        <span style={{ color: legend.changePct >= 0 ? theme.up : theme.down, fontWeight: 600 }}>
                            {legend.changePct >= 0 ? "+" : ""}{legend.changePct.toFixed(2)}%
                        </span>
                        <span style={{ color: theme.textMuted }}>Vol <b style={{ color: theme.text }}>{legend.volume.toLocaleString("en-IN")}</b></span>
                        <span style={{ color: theme.textMuted }}>{legend.time}</span>
                    </div>
                )}

                {loading && (
                    <div style={{
                        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                        background: isDark ? "rgba(14,17,23,0.65)" : "rgba(255,255,255,0.65)", zIndex: 3, fontSize: 13, color: theme.textMuted,
                    }}>
                        Loading…
                    </div>
                )}

                {error && !loading && (
                    <div style={{
                        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                        zIndex: 3, fontSize: 13, color: theme.down, padding: 16, textAlign: "center",
                    }}>
                        {error}
                    </div>
                )}

                <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
            </div>
        </div>
    );
}

/* ============================================================
   Small presentational subcomponents
   ============================================================ */

function LegendField({ label, value }: { label: string; value: number }) {
    return <span style={{ color: "inherit", opacity: 0.85 }}>{label} <b>{value.toFixed(2)}</b></span>;
}

function SelectField({
    theme, label, value, onChange, options,
}: {
    theme: ThemeT; label: string; value: string; onChange: (v: string) => void;
    options: readonly { value: string; label: string }[];
}) {
    return (
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 500 }}>{label}</span>
            <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle(theme)}>
                {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
        </label>
    );
}

function MenuSection({ title, theme }: { title: string; theme: ThemeT }) {
    return (
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: theme.textMuted, padding: "6px 10px 4px" }}>
            {title}
        </div>
    );
}

function MenuItem({ label, theme, onClick }: { label: string; theme: ThemeT; onClick: () => void }) {
    return (
        <div
            onClick={onClick}
            style={{ padding: "7px 10px", fontSize: 12.5, color: theme.text, cursor: "pointer", borderRadius: 6 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = theme.menuHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
            {label}
        </div>
    );
}

function IconBtn({ theme, title, onClick, children }: { theme: ThemeT; title: string; onClick: () => void; children: React.ReactNode }) {
    return (
        <button onClick={onClick} title={title} style={iconBtnStyle(theme)}>
            {children}
        </button>
    );
}

function IndicatorChip({
    theme, indicator, onUpdate, onRemove,
}: {
    theme: ThemeT; indicator: ActiveIndicator;
    onUpdate: (id: string, patch: Partial<ActiveIndicator>) => void;
    onRemove: (id: string) => void;
}) {
    const numInput = (val: number, onChange: (n: number) => void, width = 40) => (
        <input
            type="number" value={val}
            onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!Number.isNaN(n)) onChange(n);
            }}
            style={{ width, padding: "1px 4px", fontSize: 11, borderRadius: 4, border: `1px solid ${theme.border}`, background: "transparent", color: "inherit" }}
        />
    );

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: theme.chipBg, borderRadius: 14, padding: "4px 9px", fontSize: 11.5, color: theme.text }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: indicator.color, display: "inline-block" }} />
            <span style={{ fontWeight: 600 }}>{indicator.type}</span>

            {indicator.type === "BB" && (
                <>
                    {numInput(indicator.length, (n) => onUpdate(indicator.id, { length: n }))}
                    <span style={{ opacity: 0.5 }}>σ</span>
                    {numInput(indicator.stdDev ?? 2, (n) => onUpdate(indicator.id, { stdDev: n }), 32)}
                </>
            )}
            {indicator.type === "MACD" && (
                <>
                    {numInput(indicator.fast ?? 12, (n) => onUpdate(indicator.id, { fast: n }), 32)}
                    {numInput(indicator.slow ?? 26, (n) => onUpdate(indicator.id, { slow: n }), 32)}
                    {numInput(indicator.signalLength ?? 9, (n) => onUpdate(indicator.id, { signalLength: n }), 32)}
                </>
            )}
            {indicator.type === "STOCH" && (
                <>
                    {numInput(indicator.kPeriod ?? 14, (n) => onUpdate(indicator.id, { kPeriod: n }), 32)}
                    {numInput(indicator.dPeriod ?? 3, (n) => onUpdate(indicator.id, { dPeriod: n }), 32)}
                </>
            )}
            {!["BB", "MACD", "STOCH", "VWAP"].includes(indicator.type) &&
                numInput(indicator.length, (n) => onUpdate(indicator.id, { length: n }))}

            <button
                onClick={() => onRemove(indicator.id)}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: theme.textMuted, display: "flex", alignItems: "center" }}
                title="Remove"
            >
                <IconClose />
            </button>
        </div>
    );
}

function iconBtnStyle(theme: ThemeT) {
    return {
        width: 30, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
        border: `1px solid ${theme.border}`, borderRadius: 6, background: theme.surfaceRaised, color: theme.text, cursor: "pointer",
    } as const;
}

function toolbarBtnStyle(theme: ThemeT) {
    return {
        display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", fontSize: 12, fontWeight: 500,
        border: `1px solid ${theme.border}`, borderRadius: 6, background: theme.surfaceRaised, color: theme.text, cursor: "pointer",
    } as const;
}

function selectStyle(theme: ThemeT) {
    return {
        padding: "5px 8px", fontSize: 12, border: `1px solid ${theme.border}`, borderRadius: 6,
        background: theme.surfaceRaised, color: theme.text, outline: "none", cursor: "pointer",
    } as const;
}