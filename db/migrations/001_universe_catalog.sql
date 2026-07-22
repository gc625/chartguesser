create table if not exists community_lists (
  id text primary key,
  name varchar(60) not null,
  description varchar(240) not null default '',
  tickers jsonb not null,
  ticker_count integer not null check (ticker_count between 2 and 200),
  content_hash varchar(64) not null unique,
  created_at timestamptz not null default now()
);

create table if not exists etf_universe_cache (
  symbol varchar(15) primary key,
  name varchar(120) not null,
  issuer varchar(80) not null,
  source_url text not null,
  as_of varchar(32),
  tickers jsonb not null,
  fetched_at timestamptz not null default now()
);
