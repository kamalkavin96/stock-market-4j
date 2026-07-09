import type { UTCTimestamp } from "lightweight-charts";

export interface Candle {
    time: UTCTimestamp;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export type LinePoint = { time: UTCTimestamp; value: number };
export type HistPoint = { time: UTCTimestamp; value: number; color?: string };

/* -------- Trend / overlay -------- */

export function sma(data: Candle[], length: number): LinePoint[] {
    const out: LinePoint[] = [];
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        sum += data[i].close;
        if (i >= length) sum -= data[i - length].close;
        if (i >= length - 1) out.push({ time: data[i].time, value: sum / length });
    }
    return out;
}

function emaSeries(values: number[], length: number): number[] {
    const k = 2 / (length + 1);
    const out: number[] = new Array(values.length);
    out[0] = values[0];
    for (let i = 1; i < values.length; i++) out[i] = values[i] * k + out[i - 1] * (1 - k);
    return out;
}

export function ema(data: Candle[], length: number): LinePoint[] {
    const closes = data.map((d) => d.close);
    const vals = emaSeries(closes, length);
    return data.map((d, i) => ({ time: d.time, value: vals[i] }));
}

export function wma(data: Candle[], length: number): LinePoint[] {
    const out: LinePoint[] = [];
    const denom = (length * (length + 1)) / 2;
    for (let i = length - 1; i < data.length; i++) {
        let acc = 0;
        for (let j = 0; j < length; j++) acc += data[i - j].close * (length - j);
        out.push({ time: data[i].time, value: acc / denom });
    }
    return out;
}

export function bollinger(data: Candle[], length: number, stdDevMult: number) {
    const upper: LinePoint[] = [], mid: LinePoint[] = [], lower: LinePoint[] = [];
    for (let i = length - 1; i < data.length; i++) {
        const window = data.slice(i - length + 1, i + 1).map((d) => d.close);
        const mean = window.reduce((a, b) => a + b, 0) / length;
        const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / length;
        const sd = Math.sqrt(variance);
        mid.push({ time: data[i].time, value: mean });
        upper.push({ time: data[i].time, value: mean + stdDevMult * sd });
        lower.push({ time: data[i].time, value: mean - stdDevMult * sd });
    }
    return { upper, mid, lower };
}

export function vwap(data: Candle[]): LinePoint[] {
    const out: LinePoint[] = [];
    let cumPV = 0, cumVol = 0;
    for (const d of data) {
        const typical = (d.high + d.low + d.close) / 3;
        cumPV += typical * d.volume;
        cumVol += d.volume;
        out.push({ time: d.time, value: cumVol > 0 ? cumPV / cumVol : typical });
    }
    return out;
}

/* -------- Oscillators -------- */

export function rsi(data: Candle[], length: number): LinePoint[] {
    const out: LinePoint[] = [];
    if (data.length < length + 1) return out;
    let gainSum = 0, lossSum = 0;
    for (let i = 1; i <= length; i++) {
        const diff = data[i].close - data[i - 1].close;
        if (diff >= 0) gainSum += diff; else lossSum -= diff;
    }
    let avgGain = gainSum / length, avgLoss = lossSum / length;
    const at = (ag: number, al: number) => (al === 0 ? 100 : 100 - 100 / (1 + ag / al));
    out.push({ time: data[length].time, value: at(avgGain, avgLoss) });
    for (let i = length + 1; i < data.length; i++) {
        const diff = data[i].close - data[i - 1].close;
        avgGain = (avgGain * (length - 1) + Math.max(diff, 0)) / length;
        avgLoss = (avgLoss * (length - 1) + Math.max(-diff, 0)) / length;
        out.push({ time: data[i].time, value: at(avgGain, avgLoss) });
    }
    return out;
}

export function macd(data: Candle[], fast: number, slow: number, signalLen: number) {
    const closes = data.map((d) => d.close);
    const fastE = emaSeries(closes, fast);
    const slowE = emaSeries(closes, slow);
    const macdLine = closes.map((_, i) => fastE[i] - slowE[i]);
    const signalLine = emaSeries(macdLine, signalLen);
    const hist = macdLine.map((v, i) => v - signalLine[i]);
    return {
        macd: data.map((d, i) => ({ time: d.time, value: macdLine[i] })),
        signal: data.map((d, i) => ({ time: d.time, value: signalLine[i] })),
        histogram: data.map((d, i): HistPoint => ({
            time: d.time,
            value: hist[i],
            color: hist[i] >= 0 ? "rgba(38,166,154,0.6)" : "rgba(239,83,80,0.6)",
        })),
    };
}

export function stochastic(data: Candle[], kPeriod: number, dPeriod: number) {
    const kValues: LinePoint[] = [];
    for (let i = kPeriod - 1; i < data.length; i++) {
        const window = data.slice(i - kPeriod + 1, i + 1);
        const hi = Math.max(...window.map((d) => d.high));
        const lo = Math.min(...window.map((d) => d.low));
        const k = hi === lo ? 100 : ((data[i].close - lo) / (hi - lo)) * 100;
        kValues.push({ time: data[i].time, value: k });
    }
    const dValues: LinePoint[] = [];
    for (let i = dPeriod - 1; i < kValues.length; i++) {
        const avg = kValues.slice(i - dPeriod + 1, i + 1).reduce((a, b) => a + b.value, 0) / dPeriod;
        dValues.push({ time: kValues[i].time, value: avg });
    }
    return { k: kValues, d: dValues };
}

export function atr(data: Candle[], length: number): LinePoint[] {
    const out: LinePoint[] = [];
    if (data.length < length + 1) return out;
    const trs: number[] = [];
    for (let i = 1; i < data.length; i++) {
        trs.push(Math.max(
            data[i].high - data[i].low,
            Math.abs(data[i].high - data[i - 1].close),
            Math.abs(data[i].low - data[i - 1].close)
        ));
    }
    let val = trs.slice(0, length).reduce((a, b) => a + b, 0) / length;
    out.push({ time: data[length].time, value: val });
    for (let i = length; i < trs.length; i++) {
        val = (val * (length - 1) + trs[i]) / length;
        out.push({ time: data[i + 1].time, value: val });
    }
    return out;
}

export function cci(data: Candle[], length: number): LinePoint[] {
    const out: LinePoint[] = [];
    const typical = data.map((d) => (d.high + d.low + d.close) / 3);
    for (let i = length - 1; i < data.length; i++) {
        const window = typical.slice(i - length + 1, i + 1);
        const mean = window.reduce((a, b) => a + b, 0) / length;
        const meanDev = window.reduce((a, b) => a + Math.abs(b - mean), 0) / length;
        const value = meanDev === 0 ? 0 : (typical[i] - mean) / (0.015 * meanDev);
        out.push({ time: data[i].time, value });
    }
    return out;
}

export function williamsR(data: Candle[], length: number): LinePoint[] {
    const out: LinePoint[] = [];
    for (let i = length - 1; i < data.length; i++) {
        const window = data.slice(i - length + 1, i + 1);
        const hi = Math.max(...window.map((d) => d.high));
        const lo = Math.min(...window.map((d) => d.low));
        const value = hi === lo ? 0 : ((hi - data[i].close) / (hi - lo)) * -100;
        out.push({ time: data[i].time, value });
    }
    return out;
}

export function momentum(data: Candle[], length: number): LinePoint[] {
    const out: LinePoint[] = [];
    for (let i = length; i < data.length; i++) {
        out.push({ time: data[i].time, value: data[i].close - data[i - length].close });
    }
    return out;
}

export function roc(data: Candle[], length: number): LinePoint[] {
    const out: LinePoint[] = [];
    for (let i = length; i < data.length; i++) {
        const prev = data[i - length].close;
        out.push({ time: data[i].time, value: prev === 0 ? 0 : ((data[i].close - prev) / prev) * 100 });
    }
    return out;
}