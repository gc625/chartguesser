import YahooFinance from "yahoo-finance2";
const yf = new YahooFinance();

const intervalMap: Record<string, "1d" | "1wk" | "1mo"> = {
  Daily: "1d",
  Weekly: "1wk",
  Monthly: "1mo",
};

export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { candles: Candle[]; fetchedAt: number }>();

export async function getCandles(
  ticker: string,
  timeframe: string
): Promise<Candle[]> {
  const interval = intervalMap[timeframe] || "1d";
  const key = `${ticker}:${interval}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.candles;
  const period1 = new Date();
  period1.setFullYear(period1.getFullYear() - 6);
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
    cache.set(key, { candles, fetchedAt: Date.now() });
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

export async function sampleCurrentWindow(
  universe: string[],
  years = 5,
): Promise<{ ticker: string; candles: Candle[] }> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const ticker = universe[Math.floor(Math.random() * universe.length)];
    try {
      const all = await getCandles(ticker, "Daily");
      const latest = all.at(-1)?.t;
      if (!latest) throw new Error("insufficient range");
      const cutoff = new Date(latest);
      cutoff.setFullYear(cutoff.getFullYear() - years);
      const candles = all.filter((c) => c.t >= cutoff.getTime());
      if (candles.length >= 50) return { ticker, candles };
    } catch {
      // try another ticker
    }
  }
  throw new Error("could not sample a chart window");
}
