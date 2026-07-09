import { useState } from "react";
import CandlestickChart from "../components/charts/CandlestickChart";

export default function Home() {

    const [period, setPeriod] = useState("1year");
    const [interval, setInterval] = useState("1day");

    return (
        <div style={{ padding: 20 }}>
            <h2>SBIN Daily Chart</h2>



            <CandlestickChart
                symbol={"SBIN"}
                period={period}
                interval={interval}
                onPeriodChange={setPeriod}
                onIntervalChange={setInterval}
            />
        </div>
    );
}