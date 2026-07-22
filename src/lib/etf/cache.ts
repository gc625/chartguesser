import { ensureCatalogSchema, getDatabase } from "@/lib/db";
import type { EtfConstituents } from "./types";

const memoryCache: Map<string, EtfConstituents & { fetchedAt: number }> =
  (globalThis as typeof globalThis & { __cg_etf_cache?: Map<string, EtfConstituents & { fetchedAt: number }> })
    .__cg_etf_cache ??= new Map();

export async function getCachedEtf(symbol: string): Promise<(EtfConstituents & { fetchedAt: number }) | null> {
  const memory = memoryCache.get(symbol);
  if (memory) return memory;
  try {
    if (!await ensureCatalogSchema()) return null;
    const sql = getDatabase()!;
    const rows = await sql`
      select symbol, name, issuer, source_url, as_of, tickers, fetched_at
      from etf_universe_cache where symbol = ${symbol}
    `;
    const row = rows[0];
    if (!row) return null;
    const cached = {
      symbol: String(row.symbol),
      name: String(row.name),
      issuer: String(row.issuer),
      sourceUrl: String(row.source_url),
      asOf: row.as_of ? String(row.as_of) : undefined,
      tickers: Array.isArray(row.tickers) ? row.tickers.map(String) : [],
      fetchedAt: new Date(row.fetched_at as string).getTime(),
    };
    memoryCache.set(symbol, cached);
    return cached;
  } catch {
    return null;
  }
}

export async function setCachedEtf(value: EtfConstituents): Promise<void> {
  const fetchedAt = Date.now();
  memoryCache.set(value.symbol, { ...value, fetchedAt });
  try {
    if (!await ensureCatalogSchema()) return;
    const sql = getDatabase()!;
    await sql`
      insert into etf_universe_cache
        (symbol, name, issuer, source_url, as_of, tickers, fetched_at)
      values
        (${value.symbol}, ${value.name}, ${value.issuer}, ${value.sourceUrl},
         ${value.asOf || null}, ${sql.json(value.tickers)}, now())
      on conflict (symbol) do update set
        name = excluded.name,
        issuer = excluded.issuer,
        source_url = excluded.source_url,
        as_of = excluded.as_of,
        tickers = excluded.tickers,
        fetched_at = excluded.fetched_at
    `;
  } catch {
    // The in-memory cache still makes the resolver useful without Postgres.
  }
}
