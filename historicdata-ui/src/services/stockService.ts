import type { StockHistory } from "../models/StockHistory";
import api from "./api";

class StockService {
    async getHistory(
        symbol: string,
        period: string,
        interval: string
    ): Promise<StockHistory[]> {
        const response = await api.get<StockHistory[]>(
            `/stocks/${symbol}/history`,
            { params: { period, interval } }
        );
        return response.data;
    }

    /**
     * Fetch only the most recent candle(s) — used by live mode so we don't
     * re-download the whole period on every poll. Backend should return the
     * last 1-2 bars for the given interval (2 lets us detect if the current
     * bar closed and a new one opened).
     */
    async getLatest(symbol: string, interval: string): Promise<StockHistory[]> {
        const response = await api.get<StockHistory[]>(
            `/stocks/${symbol}/latest`,
            { params: { interval, limit: 2 } }
        );
        return response.data;
    }
}

export default new StockService();