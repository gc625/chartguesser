"use client";
import { useMemo, useState } from "react";

export default function TickerPreview({
  tickers,
  title = "Ticker pool",
}: {
  tickers: string[];
  title?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => tickers.filter((ticker) => ticker.includes(query.trim().toUpperCase())),
    [tickers, query],
  );
  const visible = expanded || query ? filtered : filtered.slice(0, 20);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-200">{title}</span>
        <span className="text-xs text-slate-500">{tickers.length} stocks</span>
      </div>
      {tickers.length > 20 && (
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter tickers"
          className="field mt-3 min-h-10 py-2 text-sm"
        />
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {visible.map((ticker) => (
          <span key={ticker} className="rounded-md bg-cyan-400/10 px-2 py-1 font-mono text-xs text-cyan-100">
            {ticker}
          </span>
        ))}
        {visible.length === 0 && <span className="text-xs text-slate-500">No matching tickers.</span>}
      </div>
      {!query && tickers.length > 20 && (
        <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-3 text-xs text-cyan-300">
          {expanded ? "Show fewer" : `Show all ${tickers.length}`}
        </button>
      )}
    </div>
  );
}
