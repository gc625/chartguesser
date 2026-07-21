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
    <div ref={boxRef} className="relative w-full">
      <div className="flex gap-2">
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
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
        />
        <button
          disabled={disabled || !tickers.includes(q.toUpperCase())}
          onClick={() => submit(q)}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 rounded-lg px-4 font-semibold text-sm"
        >
          Submit
        </button>
      </div>
      {open && matches.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          {matches.map((t, i) => (
            <div key={t} onMouseDown={() => submit(t)}
              className={`px-3 py-2 text-sm cursor-pointer ${i === active ? "bg-emerald-700" : "hover:bg-zinc-800"}`}>
              {t}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
