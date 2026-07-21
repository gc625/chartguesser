import YahooFinance from "yahoo-finance2";
const yf = new YahooFinance();

const intervalMap: Record<string, "1d" | "1wk" | "1mo"> = {
  Daily: "1d",
  Weekly: "1wk",
  Monthly: "1mo",
};

export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

const cache = new Map<string, Candle[]>();

export async function getCandles(
  ticker: string,
  timeframe: string
): Promise<Candle[]> {
  const interval = intervalMap[timeframe] || "1d";
  const key = `${ticker}:${interval}`;
  if (cache.has(key)) return cache.get(key)!;
  const period1 = new Date("2000-01-01");
  const period2 = new Date();
  try {
    const r: any = await withTimeout(yf.chart(ticker, { period1, period2, interval }), 8000);
    const quotes: any[] = r.quotes || [];
    if (quotes.length < 50) throw new Error("insufficient");
    const candles: Candle[] = quotes
      .filter((q) => q.open != null && q.close != null)
      .map((q) => ({
        t: new Date(q.date).getTime(),
        o: q.open, h: q.high, l: q.low, c: q.close, v: q.volume ?? 0,
      }));
    if (candles.length < 50) throw new Error("insufficient");
    cache.set(key, candles);
    return candles;
  } catch (e) {
    cache.delete(key);
    throw e;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export async function sampleWindow(
  universe: string[],
  timeframe: string,
  windowSize = 200,
  excludeRecentDays = 90
): Promise<{ ticker: string; candles: Candle[] }> {
  const daysPerCandle = timeframe === "Daily" ? 1 : timeframe === "Weekly" ? 7 : 30;
  const excludeCount = Math.ceil(excludeRecentDays / daysPerCandle);
  for (let attempt = 0; attempt < 8; attempt++) {
    const ticker = universe[Math.floor(Math.random() * universe.length)];
    try {
      const all = await getCandles(ticker, timeframe);
      const maxEnd = all.length - excludeCount;
      if (maxEnd <= windowSize) throw new Error("insufficient range");
      const end = Math.floor(Math.random() * (maxEnd - windowSize)) + windowSize;
      const candles = all.slice(end - windowSize, end);
      if (candles.length >= 50) return { ticker, candles };
    } catch {
      // try another ticker
    }
  }
  throw new Error("could not sample a chart window");
}
