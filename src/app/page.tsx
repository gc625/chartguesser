"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const UNIVERSES = ["S&P 500", "Nasdaq 100", "Dow 30"];
const TIMEFRAMES = ["Daily", "Weekly", "Monthly"];

export default function Home() {
  const router = useRouter();
  const [universe, setUniverse] = useState("Dow 30");
  const [rounds, setRounds] = useState(5);
  const [roundTimer, setRoundTimer] = useState(60);
  const [startingHp, setStartingHp] = useState(100);
  const [anonymizeDate, setAnonymizeDate] = useState(true);
  const [anonymizePrice, setAnonymizePrice] = useState(false);
  const [timeframe, setTimeframe] = useState("Daily");
  const [creating, setCreating] = useState(false);

  async function create() {
    setCreating(true);
    const res = await fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ universe, rounds, roundTimer, startingHp, anonymizeDate, anonymizePrice, timeframe }),
    });
    const data = await res.json();
    router.push(`/match/${data.id}`);
  }

  const card = "bg-zinc-900/60 border border-zinc-800 rounded-xl p-5";
  const label = "text-xs uppercase tracking-wide text-zinc-400 mb-1";
  const input = "w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm";

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">ChartGuesser</h1>
          <p className="text-zinc-400 mt-2">Guess the ticker. Beat your friend&apos;s HP to zero.</p>
        </div>

        <div className={card + " space-y-4"}>
          <div>
            <div className={label}>Ticker universe</div>
            <div className="grid grid-cols-3 gap-2">
              {UNIVERSES.map((u) => (
                <button key={u} onClick={() => setUniverse(u)}
                  className={`px-3 py-2 rounded-lg text-sm border ${universe === u ? "bg-emerald-600 border-emerald-500" : "bg-zinc-950 border-zinc-800"}`}>
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <div className={label}>Timeframe</div>
              <select className={input} value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
                {TIMEFRAMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={anonymizeDate} onChange={(e) => setAnonymizeDate(e.target.checked)} />
              Hide date axis
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={anonymizePrice} onChange={(e) => setAnonymizePrice(e.target.checked)} />
              Hide price axis
            </label>
          </div>
        </div>

        <button onClick={create} disabled={creating}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl py-3 font-semibold">
          {creating ? "Creating…" : "Create Match"}
        </button>
      </div>
    </main>
  );
}
