"use client";
import { useEffect, useRef, useState } from "react";

export default function TickerAutocomplete({
  universe, disabled, onSubmit,
}: {
  universe: string;
  disabled: boolean;
  onSubmit: (ticker: string) => void;
}) {
  const [tickers, setTickers] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/universe?name=${encodeURIComponent(universe)}`)
      .then((r) => r.json())
      .then((d) => setTickers(d.tickers || []))
      .catch(() => {});
  }, [universe]);

  const matches = q ? tickers.filter((t) => t.startsWith(q.toUpperCase())).slice(0, 8) : [];

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function submit(value: string) {
    const v = value.toUpperCase();
    if (!tickers.includes(v)) return;
    onSubmit(v);
    setQ("");
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative w-full min-w-0">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input
          value={q}
          disabled={disabled}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { if (matches.length) submit(matches[active]); else if (tickers.includes(q.toUpperCase())) submit(q); }
            else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, matches.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          }}
          placeholder="Type a ticker (e.g. AAPL)…"
          autoComplete="off"
          autoCapitalize="characters"
          className="w-full min-w-0 min-h-11 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-base sm:text-sm disabled:opacity-50"
        />
        <button
          disabled={disabled || !tickers.includes(q.toUpperCase())}
          onClick={() => submit(q)}
          className="min-h-11 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 rounded-lg px-3 sm:px-4 font-semibold text-sm"
        >
          Submit
        </button>
      </div>
      {open && matches.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl">
          {matches.map((t, i) => (
            <button type="button" key={t} onMouseDown={() => submit(t)}
              className={`block w-full min-h-11 px-3 py-2 text-left text-sm cursor-pointer ${i === active ? "bg-emerald-700" : "hover:bg-zinc-800"}`}>
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
