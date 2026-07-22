// Universe registry. Dynamic index lists are cached in memory, while every
// match receives a final ticker snapshot before it is created.
import aiBottlenecks from "../../data/universes/ai-bottlenecks.json";

export type UniverseSource = "built-in" | "etf" | "community" | "custom";

export type UniverseSnapshot = {
  id: string;
  name: string;
  source: UniverseSource;
  tickers: string[];
  issuer?: string;
  asOf?: string;
};

export const SYMBOL_PATTERN = /^[A-Z0-9.-]{1,15}$/;

export function normalizeTickers(value: unknown, limit = 1000): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((ticker): ticker is string => typeof ticker === "string")
    .map((ticker) => ticker.trim().toUpperCase())
    .filter((ticker) => SYMBOL_PATTERN.test(ticker))
  )].slice(0, limit);
}

const DOW_30 = [
  "AXP", "AMGN", "AMZN", "AAPL", "BA", "CAT", "CVX", "CSCO", "KO", "DIS",
  "DOW", "GS", "HD", "HON", "IBM", "INTC", "JNJ", "JPM", "MCD", "MMM",
  "MRK", "MSFT", "NKE", "PG", "CRM", "TRV", "UNH", "VZ", "V", "WMT",
];

// A local Nasdaq-100 catalog avoids accepting arbitrary uppercase text from
// a scraped page. A universe must never silently fall back to a different
// index, since that changes game answers.
const NASDAQ_100 = [
  "AAPL", "ABNB", "ADBE", "ADI", "ADP", "ADSK", "AEP", "AMAT", "AMD", "AMGN",
  "AMZN", "APP", "ARM", "ASML", "AVGO", "AZN", "BIIB", "BKNG", "BKR", "CCEP",
  "CDNS", "CEG", "CHTR", "CMCSA", "COST", "CPRT", "CRWD", "CSCO", "CSX", "CTAS",
  "CTSH", "DASH", "DDOG", "DXCM", "EA", "EXC", "FANG", "FAST", "FTNT", "GFS",
  "GILD", "GOOG", "GOOGL", "HON", "IDXX", "INTC", "INTU", "ISRG", "KDP", "KHC",
  "KLAC", "LRCX", "LULU", "MAR", "MCHP", "MDLZ", "MELI", "META", "MNST", "MPWR",
  "MRVL", "MSFT", "MU", "NFLX", "NVDA", "NXPI", "ODFL", "ORLY", "PANW", "PAYX",
  "PCAR", "PDD", "PEP", "PLTR", "PYPL", "QCOM", "REGN", "ROP", "ROST", "SBUX",
  "SMCI", "SNPS", "TEAM", "TMUS", "TSLA", "TXN", "VRSK", "VRTX", "WBD", "WDAY",
  "XEL", "ZS",
];

export const AI_BOTTLENECK_CATEGORIES = aiBottlenecks.categories;
const AI_BOTTLENECKS = normalizeTickers(aiBottlenecks.categories.flatMap((category) => category.tickers));

export const CUSTOM_UNIVERSE = "Custom basket";

const cache: Record<string, string[]> = {
  "Dow 30": DOW_30,
  "AI Bottlenecks": AI_BOTTLENECKS,
};

async function fetchTickers(url: string, pattern: RegExp): Promise<string[]> {
  const res = await fetch(url, { headers: { "User-Agent": "chartguesser/1.0" } });
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
  const html = await res.text();
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) out.add(m[1]);
  return [...out];
}

export async function getUniverse(name: string): Promise<string[]> {
  if (cache[name]) return cache[name];
  try {
    if (name === "S&P 500") {
      const t = await fetchTickers(
        "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
        /<td[^>]*>\s*<a[^>]*>([A-Z.]{1,6})<\/a>\s*<\/td>/g
      );
      cache[name] = t.length > 50 ? t : DOW_30;
    } else if (name === "Nasdaq 100") {
      cache[name] = NASDAQ_100;
    }
  } catch {
    cache[name] = name === "Nasdaq 100" ? NASDAQ_100 : DOW_30;
  }
  return cache[name] || DOW_30;
}

export const UNIVERSE_NAMES = ["S&P 500", "Nasdaq 100", "Dow 30", "AI Bottlenecks"];

export const BUILT_IN_UNIVERSES = UNIVERSE_NAMES.map((name) => ({
  id: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  name,
  source: "built-in" as const,
}));

export async function resolveBuiltInUniverse(idOrName: string): Promise<UniverseSnapshot | null> {
  const definition = BUILT_IN_UNIVERSES.find((item) => item.id === idOrName || item.name === idOrName);
  if (!definition) return null;
  return {
    ...definition,
    tickers: normalizeTickers(await getUniverse(definition.name)),
  };
}
