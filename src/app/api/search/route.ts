import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahoo = new YahooFinance();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const requestCounts = new Map<string, { count: number; startedAt: number }>();
const cache = new Map<string, { results: SearchResult[]; fetchedAt: number }>();
const CACHE_TTL_MS = 5 * 60_000;

type SearchResult = {
  symbol: string;
  name: string;
  type: "Stock" | "ETF";
};

function isRateLimited(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "anonymous";
  const now = Date.now();
  const current = requestCounts.get(ip);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    requestCounts.set(ip, { count: 1, startedAt: now });
    return false;
  }
  current.count++;
  return current.count > MAX_REQUESTS_PER_WINDOW;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (query.length < 2) return NextResponse.json({ results: [] });
  if (query.length > 50) return NextResponse.json({ error: "Search is too long." }, { status: 400 });
  if (isRateLimited(request)) return NextResponse.json({ error: "Too many searches. Try again shortly." }, { status: 429 });

  const key = query.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return NextResponse.json({ results: cached.results });

  try {
    const response = await yahoo.search(query, {
      region: "US",
      lang: "en-US",
      quotesCount: 12,
      newsCount: 0,
      enableFuzzyQuery: true,
    });
    const results = response.quotes
      .filter((quote) => quote.isYahooFinance && (quote.quoteType === "EQUITY" || quote.quoteType === "ETF"))
      .filter((quote) => /^[A-Z0-9.-]{1,15}$/.test(quote.symbol))
      .slice(0, 8)
      .map((quote) => ({
        symbol: quote.symbol,
        name: quote.longname || quote.shortname || quote.symbol,
        type: quote.quoteType === "ETF" ? "ETF" as const : "Stock" as const,
      }));
    cache.set(key, { results, fetchedAt: Date.now() });
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Ticker search is temporarily unavailable." }, { status: 502 });
  }
}
