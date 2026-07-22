import { createHash, randomUUID } from "node:crypto";
import { ensureCatalogSchema, getDatabase } from "./db";
import { normalizeTickers, type UniverseSnapshot } from "./universes";

export type CommunityList = {
  id: string;
  name: string;
  description: string;
  tickers: string[];
  tickerCount: number;
  createdAt: string;
};

export class CommunityDatabaseUnavailableError extends Error {}
export class DuplicateCommunityListError extends Error {}

function fromRow(row: Record<string, unknown>): CommunityList {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description || ""),
    tickers: Array.isArray(row.tickers) ? row.tickers.map(String) : [],
    tickerCount: Number(row.ticker_count),
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

async function database() {
  try {
    if (!await ensureCatalogSchema()) throw new CommunityDatabaseUnavailableError();
    return getDatabase()!;
  } catch {
    throw new CommunityDatabaseUnavailableError();
  }
}

export async function listCommunityLists(): Promise<CommunityList[]> {
  const sql = await database();
  const rows = await sql`
    select id, name, description, tickers, ticker_count, created_at
    from community_lists order by created_at desc limit 100
  `;
  return rows.map((row) => fromRow(row));
}

export async function getCommunityList(id: string): Promise<CommunityList | null> {
  if (!/^[a-f0-9]{12}$/.test(id)) return null;
  const sql = await database();
  const rows = await sql`
    select id, name, description, tickers, ticker_count, created_at
    from community_lists where id = ${id}
  `;
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function createCommunityList(input: {
  name: unknown;
  description: unknown;
  tickers: unknown;
}): Promise<CommunityList> {
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ").slice(0, 60) : "";
  const description = typeof input.description === "string"
    ? input.description.trim().replace(/\s+/g, " ").slice(0, 240)
    : "";
  const tickers = normalizeTickers(input.tickers, 200);
  if (name.length < 3) throw new TypeError("List name must be at least 3 characters.");
  if (tickers.length < 2) throw new TypeError("Add at least two valid stock tickers.");
  const contentHash = createHash("sha256").update([...tickers].sort().join(",")).digest("hex");
  const id = randomUUID().replaceAll("-", "").slice(0, 12);
  const sql = await database();
  try {
    const rows = await sql`
      insert into community_lists
        (id, name, description, tickers, ticker_count, content_hash)
      values
        (${id}, ${name}, ${description}, ${sql.json(tickers)}, ${tickers.length}, ${contentHash})
      returning id, name, description, tickers, ticker_count, created_at
    `;
    return fromRow(rows[0]);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      throw new DuplicateCommunityListError("That ticker list is already in the community catalog.");
    }
    throw error;
  }
}

export async function resolveCommunityUniverse(id: string): Promise<UniverseSnapshot | null> {
  const list = await getCommunityList(id);
  if (!list) return null;
  return {
    id: list.id,
    name: list.name,
    source: "community",
    tickers: list.tickers,
  };
}
