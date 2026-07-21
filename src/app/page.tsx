"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const UNIVERSES = ["S&P 500", "Nasdaq 100", "Dow 30", "AI Infrastructure & Semis", "Custom basket"];
const SYMBOL_PATTERN = /^[A-Z0-9.-]{1,15}$/;
type SearchResult = { symbol: string; name: string; type: "Stock" | "ETF" };

export default function Home() {
  const router = useRouter();
  const [universe, setUniverse] = useState("Dow 30");
  const [customTickers, setCustomTickers] = useState<string[]>([]);
  const [pastedTickers, setPastedTickers] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [rounds, setRounds] = useState(5);
  const [roundTimer, setRoundTimer] = useState(60);
  const [startingHp, setStartingHp] = useState(100);
  const [guessMode, setGuessMode] = useState<"single" | "unlimited">("single");
  const [wrongGuessPenalty, setWrongGuessPenalty] = useState(5);
  const [anonymizeDate, setAnonymizeDate] = useState(false);
  const [anonymizePrice, setAnonymizePrice] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ universe, customTickers, rounds, roundTimer, startingHp, guessMode, wrongGuessPenalty, anonymizeDate, anonymizePrice }),
      });
      if (!res.ok) throw new Error("Could not create the match.");
      const data = await res.json();
      router.push(`/match/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the match.");
      setCreating(false);
    }
  }

  function addTickers(values: string[]) {
    const normalized = values.map((value) => value.trim().toUpperCase()).filter((ticker) => SYMBOL_PATTERN.test(ticker));
    setCustomTickers((current) => [...new Set([...current, ...normalized])].slice(0, 50));
  }

  function addPastedTickers() {
    addTickers(pastedTickers.split(/[\s,]+/));
    setPastedTickers("");
  }

  async function searchTickers() {
    const query = searchQuery.trim();
    if (query.length < 2) return;
    setSearching(true);
    setSearchError("");
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json() as { results?: SearchResult[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not search tickers.");
      setSearchResults(data.results || []);
    } catch (err) {
      setSearchResults([]);
      setSearchError(err instanceof Error ? err.message : "Could not search tickers.");
    } finally {
      setSearching(false);
    }
  }

  const card = "panel p-5 sm:p-6";
  const label = "eyebrow mb-2";
  const input = "field text-sm";

  return (
    <main className="app-shell flex min-h-dvh items-start justify-center px-4 py-8 sm:items-center sm:p-6">
      <div className="w-full max-w-lg space-y-5 sm:space-y-6">
        <div className="text-center sm:text-left">
          <p className="eyebrow">Market pattern duel</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-.04em] sm:text-5xl">Chart<span className="text-cyan-300">Guesser</span></h1>
          <p className="mt-3 text-sm text-slate-400 sm:text-base">Read the price action. Name the ticker. Outplay your friend.</p>
        </div>

        <div className={card + " space-y-4"}>
          <div>
            <div className={label}>Ticker universe</div>
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
              {UNIVERSES.map((u) => (
                <button key={u} onClick={() => setUniverse(u)}
                  className={`min-h-11 rounded-xl border px-3 py-2 text-sm transition-colors ${universe === u ? "border-cyan-300 bg-cyan-400 text-slate-950" : "border-slate-700 bg-slate-950 hover:border-slate-500"}`}>
                  {u === "AI Infrastructure & Semis" ? "AI Infrastructure & Semis · SOXX" : u}
                </button>
              ))}
            </div>
            {universe === "Custom basket" && (
              <div className="mt-3 space-y-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-200">Build your basket</p>
                  <p className="mt-1 text-xs text-slate-500">Add 2–50 US stock or ETF symbols. This list is locked when the match is created.</p>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") searchTickers(); }} className="field min-w-0 text-sm" placeholder="Search symbol or company" />
                  <button type="button" onClick={searchTickers} disabled={searching || searchQuery.trim().length < 2} className="secondary-button px-3 text-sm disabled:opacity-40">{searching ? "…" : "Search"}</button>
                </div>
                {searchError && <p className="text-xs text-rose-300">{searchError}</p>}
                {searchResults.length > 0 && <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-800">
                  {searchResults.map((result) => <button type="button" key={`${result.type}:${result.symbol}`} onClick={() => addTickers([result.symbol])} disabled={customTickers.includes(result.symbol)} className="flex min-h-11 w-full items-center justify-between gap-3 border-b border-slate-800 px-3 text-left text-sm last:border-0 hover:bg-slate-900 disabled:opacity-40"><span className="min-w-0 truncate"><strong>{result.symbol}</strong><span className="ml-2 text-xs text-slate-500">{result.name}</span></span><span className="text-xs text-cyan-300">{customTickers.includes(result.symbol) ? "Added" : result.type}</span></button>)}
                </div>}
                <div className="flex gap-2">
                  <textarea value={pastedTickers} onChange={(e) => setPastedTickers(e.target.value)} className="field min-h-20 flex-1 resize-none text-sm" placeholder="Paste symbols: NVDA, SOXX, VRT…" />
                  <button type="button" onClick={addPastedTickers} disabled={!pastedTickers.trim()} className="secondary-button self-end px-3 text-sm disabled:opacity-40">Add</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {customTickers.length === 0 ? <span className="text-xs text-slate-600">No tickers selected yet.</span> : customTickers.map((ticker) => <button type="button" key={ticker} onClick={() => setCustomTickers((current) => current.filter((item) => item !== ticker))} className="rounded-md bg-cyan-400/10 px-2 py-1 font-mono text-xs text-cyan-100 hover:bg-rose-400/20" title={`Remove ${ticker}`}>{ticker} ×</button>)}
                </div>
                <p className={`text-xs ${customTickers.length >= 2 ? "text-slate-400" : "text-amber-300"}`}>{customTickers.length}/50 selected {customTickers.length < 2 && "· add at least two to create this match"}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-4">
            <div>
              <div className={label}>Rounds</div>
              <select className={input} value={rounds} onChange={(e) => setRounds(Number(e.target.value))}>
                {[1, 3, 5, 7, 10].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <div className={label}>Round timer (s)</div>
              <select className={input} value={roundTimer} onChange={(e) => setRoundTimer(Number(e.target.value))}>
                {[30, 60, 90, 120].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <div className={label}>Starting HP</div>
              <select className={input} value={startingHp} onChange={(e) => setStartingHp(Number(e.target.value))}>
                {[50, 100, 150, 200].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className={label}>Guess rules</div>
            <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
              <button onClick={() => setGuessMode("single")} className={`rounded-xl border p-3 text-left text-sm ${guessMode === "single" ? "border-cyan-300 bg-cyan-400/10" : "border-slate-800 bg-slate-950"}`}><strong className="block">One guess each</strong><span className="mt-1 block text-xs text-slate-400">Both players get the full timer.</span></button>
              <button onClick={() => setGuessMode("unlimited")} className={`rounded-xl border p-3 text-left text-sm ${guessMode === "unlimited" ? "border-cyan-300 bg-cyan-400/10" : "border-slate-800 bg-slate-950"}`}><strong className="block">Unlimited guesses</strong><span className="mt-1 block text-xs text-slate-400">Wrong answers cost HP.</span></button>
            </div>
            {guessMode === "unlimited" && <div className="mt-3"><div className={label}>Wrong guess penalty</div><select className={input} value={wrongGuessPenalty} onChange={(e) => setWrongGuessPenalty(Number(e.target.value))}>{[1, 3, 5, 10].map((n) => <option key={n} value={n}>−{n} HP per wrong guess</option>)}</select></div>}
          </div>

          <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
            <label className="flex min-h-11 items-center gap-3 rounded-xl bg-slate-950 px-3 text-sm">
              <input className="size-4" type="checkbox" checked={anonymizeDate} onChange={(e) => setAnonymizeDate(e.target.checked)} />
              Hide date axis
            </label>
            <label className="flex min-h-11 items-center gap-3 rounded-xl bg-slate-950 px-3 text-sm">
              <input className="size-4" type="checkbox" checked={anonymizePrice} onChange={(e) => setAnonymizePrice(e.target.checked)} />
              Hide price axis
            </label>
          </div>
        </div>

        {error && <p role="alert" className="text-center text-sm text-rose-300">{error}</p>}
        <button onClick={create} disabled={creating || (universe === "Custom basket" && customTickers.length < 2)}
          className="primary-button w-full disabled:opacity-50">
          {creating ? "Creating…" : "Create Match"}
        </button>
      </div>
    </main>
  );
}
