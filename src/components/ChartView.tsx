"use client";
import { useEffect, useRef } from "react";
import { createChart, ColorType, CandlestickSeries, HistogramSeries } from "lightweight-charts";
import type { WindowCandle } from "@/lib/useMatch";

export default function ChartView({
  candles, anonymizeDate, anonymizePrice,
}: {
  candles: WindowCandle[];
  anonymizeDate: boolean;
  anonymizePrice: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !candles.length) return;
    const chart = createChart(ref.current, {
      layout: { background: { type: ColorType.Solid, color: "#0a0a0a" }, textColor: "#d4d4d8" },
      grid: { vertLines: { color: "#27272a" }, horzLines: { color: "#27272a" } },
      width: ref.current.clientWidth,
      height: ref.current.clientHeight,
      timeScale: { visible: !anonymizeDate },
      rightPriceScale: { visible: !anonymizePrice },
    });
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e", downColor: "#ef4444", borderVisible: false,
      wickUpColor: "#22c55e", wickDownColor: "#ef4444",
    });
    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" }, priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    const data = candles.map((c) => ({
      time: anonymizeDate ? (c.i as any) : (c.i / 1000) as any,
      open: c.o, high: c.h, low: c.l, close: c.c,
    }));
    candleSeries.setData(data);
    volSeries.setData(candles.map((c) => ({ time: anonymizeDate ? (c.i as any) : (c.i / 1000) as any, value: c.v, color: "#3f3f46" })));
    chart.timeScale().fitContent();

    const onResize = () => {
      if (ref.current) chart.applyOptions({ width: ref.current.clientWidth, height: ref.current.clientHeight });
    };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); chart.remove(); };
  }, [candles, anonymizeDate, anonymizePrice]);

  return <div ref={ref} className="w-full h-full" />;
}
