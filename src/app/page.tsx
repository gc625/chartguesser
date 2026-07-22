"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TickerPreview from "@/components/TickerPreview";

const BUILT_INS = ["S&P 500", "Nasdaq 100", "Dow 30", "AI Bottlenecks"];
const SYMBOL_PATTERN = /^[A-Z0-9.-]{1,15}$/;
type SearchResult = { symbol: string; name: string; type: "Stock" | "ETF" };
type UniverseSource = "built-in" | "etf" | "community" | "custom";
type CommunityList = { id: string; name: string; description: string; tickers: string[]; tickerCount: number };

export default function Home() {
  const router = useRouter();
  const [universeSource, setUniverseSource] = useState<UniverseSource>("built-in");
  const [universe, setUniverse] = useState("Dow 30");
  const [universeId, setUniverseId] = useState("dow-30");
  const [previewTickers, setPreviewTickers] = useState<string[]>([]);
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
  const [etfSymbol, setEtfSymbol] = useState("");
  const [resolvingEtf, setResolvingEtf] = useState(false);
  const [communityLists, setCommunityLists] = useState<CommunityList[]>([]);
  const [communityError, setCommunityError] = useState("");
  const [listName, setListName] = useState("");
  const [listDescription, setListDescription] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState("");

  useEffect(() => {
    if (universeSource !== "built-in") return;
    fetch(`/api/universe?name=${encodeURIComponent(universe)}`)
      .then((response) => response.json())
      .then((data) => setPreviewTickers(data.tickers || []))
      .catch(() => setPreviewTickers([]));
  }, [universe, universeSource]);

  useEffect(() => {
    if (universeSource !== "community" || communityLists.length) return;
    fetch("/api/lists")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setCommunityLists(data.lists || []);
      })
      .catch((err) => setCommunityError(err instanceof Error ? err.message : "Could not load lists."));
  }, [universeSource, communityLists.length]);

  async function create() {
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universe,
          universeId,
          universeSource,
          universeName: universe,
          customTickers,
          rounds,
          roundTimer,
          startingHp,
          guessMode,
          wrongGuessPenalty,
          anonymizeDate,
          anonymizePrice,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create the match.");
      router.push(`/match/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the match.");
      setCreating(false);
    }
  }

  async function resolveEtfSelection() {
    const symbol = etfSymbol.trim().toUpperCase();
    if (!SYMBOL_PATTERN.test(symbol)) return;
    setResolvingEtf(true);
    setError("");
    try {
      const response = await fetch(`/api/etf/${encodeURIComponent(symbol)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load ETF holdings.");
      setUniverseId(data.symbol);
      setUniverse(`${data.symbol} constituents`);
      setPreviewTickers(data.tickers || []);
    } catch (err) {
      setUniverseId("");
      setPreviewTickers([]);
      setError(err instanceof Error ? err.message : "Could not load ETF holdings.");
    } finally {
      setResolvingEtf(false);
    }
  }

  async function publishList() {
    setPublishing(true);
    setError("");
    setPublished("");
    try {
      const response = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: listName, description: listDescription, tickers: customTickers, website: "" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not publish this list.");
      setPublished(`Published as “${data.list.name}”`);
      setCommunityLists((current) => [data.list, ...current]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish this list.");
    } finally {
      setPublishing(false);
    }
  }

  function addTickers(values: string[]) {
    const normalized = values.map((value) => value.trim().toUpperCase()).filter((ticker) => SYMBOL_PATTERN.test(ticker));
    setCustomTickers((current) => [...new Set([...current, ...normalized])].slice(0, 200));
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
  const selectedTickers = universeSource === "custom" ? customTickers : previewTickers;

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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([
                ["built-in", "Built-ins"],
                ["etf", "ETF"],
                ["community", "Community"],
                ["custom", "Create list"],
              ] as [UniverseSource, string][]).map(([source, title]) => (
                <button
                  type="button"
                  key={source}
                  onClick={() => {
                    setUniverseSource(source);
                    setError("");
                    setPreviewTickers(source === "custom" ? customTickers : []);
                    if (source === "custom") {
                      setUniverse("Custom basket");
                      setUniverseId("custom");
                    }
                  }}
                  className={`min-h-11 rounded-xl border px-2 text-xs font-semibold ${universeSource === source ? "border-cyan-300 bg-cyan-400 text-slate-950" : "border-slate-700 bg-slate-950 text-slate-300"}`}
                >
                  {title}
                </button>
              ))}
            </div>

            {universeSource === "built-in" && (
              <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                {BUILT_INS.map((name) => (
                  <button
                    type="button"
                    key={name}
                    onClick={() => {
                      setUniverse(name);
                      setUniverseId(name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
                    }}
                    className={`min-h-11 rounded-xl border px-3 py-2 text-sm transition-colors ${universe === name ? "border-cyan-300 bg-cyan-400/10 text-cyan-100" : "border-slate-700 bg-slate-950 hover:border-slate-500"}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}

            {universeSource === "etf" && (
              <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                <p className="text-sm font-medium">Play an ETF&apos;s constituents</p>
                <p className="mt-1 text-xs text-slate-500">Official free feeds currently cover SOXX, SMH, and supported Invesco funds.</p>
                <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <input
                    value={etfSymbol}
                    onChange={(event) => setEtfSymbol(event.target.value.toUpperCase())}
                    onKeyDown={(event) => { if (event.key === "Enter") resolveEtfSelection(); }}
                    className="field min-w-0 text-sm"
                    placeholder="ETF symbol, e.g. SOXX"
                    maxLength={15}
                  />
                  <button type="button" onClick={resolveEtfSelection} disabled={resolvingEtf || !etfSymbol.trim()} className="secondary-button px-3 text-sm disabled:opacity-40">
                    {resolvingEtf ? "Loading…" : "Load"}
                  </button>
                </div>
              </div>
            )}

            {universeSource === "community" && (
              <div className="mt-3 space-y-2">
                {communityError && <p className="text-xs text-amber-300">{communityError}</p>}
                {!communityError && communityLists.length === 0 && <p className="text-sm text-slate-500">No community lists yet.</p>}
                {communityLists.map((list) => (
                  <button
                    type="button"
                    key={list.id}
                    onClick={() => {
                      setUniverseId(list.id);
                      setUniverse(list.name);
                      setPreviewTickers(list.tickers);
                    }}
                    className={`w-full rounded-xl border p-3 text-left ${universeId === list.id ? "border-cyan-300 bg-cyan-400/10" : "border-slate-800 bg-slate-950"}`}
                  >
                    <span className="flex justify-between gap-3 text-sm font-medium"><span>{list.name}</span><span className="text-slate-500">{list.tickerCount} stocks</span></span>
                    {list.description && <span className="mt-1 block text-xs text-slate-500">{list.description}</span>}
                  </button>
                ))}
              </div>
            )}

            {universeSource === "custom" && (
              <div className="mt-3 space-y-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-200">Build your basket</p>
                  <p className="mt-1 text-xs text-slate-500">Add 2–200 US-listed stocks. The list is locked when the match is created.</p>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") searchTickers(); }} className="field min-w-0 text-sm" placeholder="Search symbol or company" />
                  <button type="button" onClick={searchTickers} disabled={searching || searchQuery.trim().length < 2} className="secondary-button px-3 text-sm disabled:opacity-40">{searching ? "…" : "Search"}</button>
                </div>
                {searchError && <p className="text-xs text-rose-300">{searchError}</p>}
                {searchResults.length > 0 && <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-800">
                  {searchResults.filter((result) => result.type === "Stock").map((result) => <button type="button" key={result.symbol} onClick={() => addTickers([result.symbol])} disabled={customTickers.includes(result.symbol)} className="flex min-h-11 w-full items-center justify-between gap-3 border-b border-slate-800 px-3 text-left text-sm last:border-0 hover:bg-slate-900 disabled:opacity-40"><span className="min-w-0 truncate"><strong>{result.symbol}</strong><span className="ml-2 text-xs text-slate-500">{result.name}</span></span><span className="text-xs text-cyan-300">{customTickers.includes(result.symbol) ? "Added" : "Stock"}</span></button>)}
                </div>}
                <div className="flex gap-2">
                  <textarea value={pastedTickers} onChange={(e) => setPastedTickers(e.target.value)} className="field min-h-20 flex-1 resize-none text-sm" placeholder="Paste symbols: NVDA, COHR, VRT…" />
                  <button type="button" onClick={addPastedTickers} disabled={!pastedTickers.trim()} className="secondary-button self-end px-3 text-sm disabled:opacity-40">Add</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {customTickers.length === 0 ? <span className="text-xs text-slate-600">No tickers selected yet.</span> : customTickers.map((ticker) => <button type="button" key={ticker} onClick={() => setCustomTickers((current) => current.filter((item) => item !== ticker))} className="rounded-md bg-cyan-400/10 px-2 py-1 font-mono text-xs text-cyan-100 hover:bg-rose-400/20" title={`Remove ${ticker}`}>{ticker} ×</button>)}
                </div>
                <p className={`text-xs ${customTickers.length >= 2 ? "text-slate-400" : "text-amber-300"}`}>{customTickers.length}/200 selected {customTickers.length < 2 && "· add at least two to create this match"}</p>
                <div className="space-y-2 border-t border-slate-800 pt-3">
                  <p className="text-sm font-medium">Publish to Community</p>
                  <input value={listName} onChange={(event) => setListName(event.target.value)} className="field text-sm" placeholder="List name" maxLength={60} />
                  <input value={listDescription} onChange={(event) => setListDescription(event.target.value)} className="field text-sm" placeholder="Short description (optional)" maxLength={240} />
                  <button type="button" onClick={publishList} disabled={publishing || listName.trim().length < 3 || customTickers.length < 2} className="secondary-button w-full text-sm disabled:opacity-40">
                    {publishing ? "Publishing…" : "Publish immutable list"}
                  </button>
                  {published && <p className="text-xs text-cyan-300">{published}</p>}
                </div>
              </div>
            )}

            {(universeSource === "custom" ? customTickers : previewTickers).length > 0 && (
              <div className="mt-3">
                <TickerPreview tickers={universeSource === "custom" ? customTickers : previewTickers} />
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
        <button onClick={create} disabled={creating || selectedTickers.length < 2}
          className="primary-button w-full disabled:opacity-50">
          {creating ? "Creating…" : "Create Match"}
        </button>
      </div>
    </main>
  );
}
