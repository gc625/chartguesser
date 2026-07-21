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
    const container = ref.current;
    const chart = createChart(container, {
      layout: { background: { type: ColorType.Solid, color: "#0a0a0a" }, textColor: "#d4d4d8" },
      grid: { vertLines: { color: "#27272a" }, horzLines: { color: "#27272a" } },
      width: Math.max(container.clientWidth, 1),
      height: Math.max(container.clientHeight, 1),
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

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) chart.resize(width, height);
    });
    observer.observe(container);
    return () => { observer.disconnect(); chart.remove(); };
  }, [candles, anonymizeDate, anonymizePrice]);

  return <div ref={ref} className="h-full min-h-0 w-full min-w-0 overflow-hidden rounded-xl" />;
}
