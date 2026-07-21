"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const UNIVERSES = ["S&P 500", "Nasdaq 100", "Dow 30"];

export default function Home() {
  const router = useRouter();
  const [universe, setUniverse] = useState("Dow 30");
  const [rounds, setRounds] = useState(5);
  const [roundTimer, setRoundTimer] = useState(60);
  const [startingHp, setStartingHp] = useState(100);
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
        body: JSON.stringify({ universe, rounds, roundTimer, startingHp, anonymizeDate, anonymizePrice }),
      });
      if (!res.ok) throw new Error("Could not create the match.");
      const data = await res.json();
      router.push(`/match/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the match.");
      setCreating(false);
    }
  }

  const card = "bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 sm:p-5";
  const label = "text-xs uppercase tracking-wide text-zinc-400 mb-1";
  const input = "w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm";

  return (
    <main className="min-h-dvh bg-zinc-950 text-zinc-100 flex items-start sm:items-center justify-center px-4 py-8 sm:p-6">
      <div className="w-full max-w-lg space-y-5 sm:space-y-6">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">ChartGuesser</h1>
          <p className="text-sm sm:text-base text-zinc-400 mt-2">Guess the ticker. Beat your friend&apos;s HP to zero.</p>
        </div>

        <div className={card + " space-y-4"}>
          <div>
            <div className={label}>Ticker universe</div>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2">
              {UNIVERSES.map((u) => (
                <button key={u} onClick={() => setUniverse(u)}
                  className={`min-h-11 px-3 py-2 rounded-lg text-sm border transition-colors ${universe === u ? "bg-emerald-600 border-emerald-500" : "bg-zinc-950 border-zinc-800 hover:border-zinc-600"}`}>
                  {u}
                </button>
              ))}
            </div>
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

          <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
            <label className="flex min-h-11 items-center gap-3 rounded-lg bg-zinc-950 px-3 text-sm">
              <input className="size-4" type="checkbox" checked={anonymizeDate} onChange={(e) => setAnonymizeDate(e.target.checked)} />
              Hide date axis
            </label>
            <label className="flex min-h-11 items-center gap-3 rounded-lg bg-zinc-950 px-3 text-sm">
              <input className="size-4" type="checkbox" checked={anonymizePrice} onChange={(e) => setAnonymizePrice(e.target.checked)} />
              Hide price axis
            </label>
          </div>
        </div>

        {error && <p role="alert" className="text-center text-sm text-rose-400">{error}</p>}
        <button onClick={create} disabled={creating}
          className="w-full min-h-12 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl py-3 font-semibold transition-colors">
          {creating ? "Creating…" : "Create Match"}
        </button>
      </div>
    </main>
  );
}
