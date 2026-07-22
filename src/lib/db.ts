import postgres from "postgres";

type DatabaseClient = ReturnType<typeof postgres>;

let client: DatabaseClient | null | undefined;
let schemaPromise: Promise<void> | null = null;

export function getDatabase(): DatabaseClient | null {
  if (client !== undefined) return client;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    client = null;
    return client;
  }
  const hostname = new URL(connectionString).hostname;
  const ssl = hostname.endsWith(".render.com") ? "require" as const : undefined;
  client = postgres(connectionString, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ...(ssl ? { ssl } : {}),
  });
  return client;
}

export async function ensureCatalogSchema(): Promise<boolean> {
  const sql = getDatabase();
  if (!sql) return false;
  schemaPromise ??= (async () => {
    await sql`
      create table if not exists community_lists (
        id text primary key,
        name varchar(60) not null,
        description varchar(240) not null default '',
        tickers jsonb not null,
        ticker_count integer not null check (ticker_count between 2 and 200),
        content_hash varchar(64) not null unique,
        created_at timestamptz not null default now()
      )
    `;
    await sql`
      create table if not exists etf_universe_cache (
        symbol varchar(15) primary key,
        name varchar(120) not null,
        issuer varchar(80) not null,
        source_url text not null,
        as_of varchar(32),
        tickers jsonb not null,
        fetched_at timestamptz not null default now()
      )
    `;
  })().catch((error) => {
    schemaPromise = null;
    throw error;
  });
  await schemaPromise;
  return true;
}
