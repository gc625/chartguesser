import { getCachedEtf, setCachedEtf } from "./cache";
import { parseInvescoJson, parseIsharesCsv, parseVanEckHtml } from "./parsers";
import { UnsupportedEtfError, type EtfConstituents } from "./types";

export type { EtfConstituents } from "./types";
export { UnsupportedEtfError } from "./types";

const FRESH_MS = 24 * 60 * 60 * 1000;
const headers = { "User-Agent": "ChartGuesser/1.0 universe-resolver" };

const ISHARES: Record<string, {
  name: string;
  url: string;
  fallbackTickers: string[];
  fallbackAsOf: string;
}> = {
  SOXX: {
    name: "iShares Semiconductor ETF",
    url: "https://www.ishares.com/us/products/239705/ishares-semiconductor-etf/1467271812596.ajax?fileType=csv&fileName=SOXX_holdings&dataType=fund",
    fallbackAsOf: "2026-07-17",
    fallbackTickers: [
      "AMD", "NVDA", "MU", "AVGO", "INTC", "AMAT", "KLAC", "TSM", "LRCX", "TXN",
      "MRVL", "ADI", "NXPI", "MPWR", "QCOM", "TER", "ASML", "MCHP", "ALAB", "ON",
      "CRDO", "ASX", "ENTG", "MTSI", "UMC", "RMBS", "NVMI", "STM", "ARM", "SWKS",
    ],
  },
};

const VANECK: Record<string, {
  name: string;
  url: string;
  fallbackTickers: string[];
  fallbackAsOf: string;
}> = {
  SMH: {
    name: "VanEck Semiconductor ETF",
    url: "https://www.vaneck.com/us/en/investments/semiconductor-etf-smh",
    fallbackAsOf: "2026-07-17",
    fallbackTickers: [
      "NVDA", "TSM", "AVGO", "AMD", "ASML", "AMAT", "MU", "TXN", "KLAC", "LRCX",
      "ADI", "INTC", "QCOM", "MRVL", "CDNS", "SNPS", "MPWR", "NXPI", "STM", "TER",
      "ARM", "ALAB", "MCHP", "ON", "SWKS",
    ],
  },
};

async function fetchChecked(url: string): Promise<Response> {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Holdings source returned ${response.status}.`);
  return response;
}

async function fetchLive(symbol: string): Promise<EtfConstituents> {
  const iShares = ISHARES[symbol];
  if (iShares) {
    try {
      const parsed = parseIsharesCsv(await (await fetchChecked(iShares.url)).text());
      if (parsed.tickers.length < 2) throw new Error("No equity constituents were found.");
      return { symbol, name: iShares.name, issuer: "iShares", sourceUrl: iShares.url, ...parsed };
    } catch {
      return {
        symbol,
        name: iShares.name,
        issuer: "iShares",
        sourceUrl: iShares.url,
        asOf: iShares.fallbackAsOf,
        tickers: iShares.fallbackTickers,
        stale: true,
      };
    }
  }

  const vanEck = VANECK[symbol];
  if (vanEck) {
    try {
      const parsed = parseVanEckHtml(await (await fetchChecked(vanEck.url)).text());
      return { symbol, name: vanEck.name, issuer: "VanEck", sourceUrl: vanEck.url, ...parsed };
    } catch {
      return {
        symbol,
        name: vanEck.name,
        issuer: "VanEck",
        sourceUrl: vanEck.url,
        asOf: vanEck.fallbackAsOf,
        tickers: vanEck.fallbackTickers,
        stale: true,
      };
    }
  }

  const invescoUrl = `https://dng-api.invesco.com/cache/v1/accounts/en_US/shareclasses/${encodeURIComponent(symbol)}/holdings/fund?idType=ticker&interval=daily&productType=ETF&loadType=initial`;
  try {
    const response = await fetchChecked(invescoUrl);
    const tickers = parseInvescoJson(await response.json(), symbol);
    if (tickers.length < 2) throw new Error("No complete holdings returned.");
    return {
      symbol,
      name: `${symbol} constituent universe`,
      issuer: "Invesco",
      sourceUrl: invescoUrl,
      tickers,
    };
  } catch {
    throw new UnsupportedEtfError(symbol);
  }
}

export async function resolveEtf(symbolInput: string): Promise<EtfConstituents> {
  const symbol = symbolInput.trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,15}$/.test(symbol)) throw new UnsupportedEtfError(symbol || "ETF");
  const cached = await getCachedEtf(symbol);
  if (cached && Date.now() - cached.fetchedAt < FRESH_MS) return cached;
  try {
    const result = await fetchLive(symbol);
    await setCachedEtf(result);
    return result;
  } catch (error) {
    if (cached?.tickers.length) return { ...cached, stale: true };
    throw error;
  }
}
