"use client";
import { useState, useEffect } from "react";
import { useMatch } from "@/lib/useMatch";
import ChartView from "@/components/ChartView";
import TickerAutocomplete from "@/components/TickerAutocomplete";

export default function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [entered, setEntered] = useState(false);

  useEffect(() => { params.then((p) => setId(p.id)); }, [params]);

  if (!id) return <div className="min-h-screen bg-zinc-950" />;
  if (!entered) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold text-center">Join Match</h1>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Display name"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2"
            onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) setEntered(true); }}
          />
          <button
            disabled={!name.trim()} onClick={() => setEntered(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-lg py-2 font-semibold"
          >
            Join
          </button>
        </div>
      </main>
    );
  }
  return <Game matchId={id} displayName={name.trim()} />;
}

function HpBar({ name, hp, max, me }: { name: string; hp: number; max: number; me: boolean }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  return (
    <div className="flex-1">
      <div className="flex justify-between text-xs mb-1">
        <span className={me ? "text-emerald-400 font-semibold" : "text-zinc-300"}>{name}{me ? " (you)" : ""}</span>
        <span>{hp}/{max}</span>
      </div>
      <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${me ? "bg-emerald-500" : "bg-rose-500"} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Game({ matchId, displayName }: { matchId: string; displayName: string }) {
  const { state, setReady, submitGuess } = useMatch(matchId, displayName);
  const me = state.players.find((p) => p.id === state.playerId);
  const opp = state.players.find((p) => p.id !== state.playerId);
  const maxHp = state.config?.startingHp || 100;
  const hpOf = (pid: string | null) => (pid ? (state.round?.hp?.[pid] ?? state.roundResult?.hp?.[pid] ?? me?.id === pid ? (me as any).hp : 0) : 0);

  if (state.error && state.phase === "lobby") {
    return <Shell><div className="text-center text-rose-400">{state.error}</div></Shell>;
  }

  // LOBBY
  if (state.phase === "lobby") {
    return (
      <Shell>
        <h1 className="text-2xl font-bold mb-1">Lobby</h1>
        <p className="text-zinc-400 text-sm mb-6">Share this link: <span className="text-emerald-400 select-all">{typeof window !== "undefined" ? window.location.href : ""}</span></p>
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[0, 1].map((i) => {
            const p = state.players[i];
            return (
              <div key={i} className={`p-5 rounded-xl border ${p ? "border-emerald-700 bg-zinc-900" : "border-dashed border-zinc-700 bg-zinc-900/40"}`}>
                <div className="text-lg font-semibold">{p ? p.name : "Waiting…"}</div>
                <div className={`text-sm mt-1 ${p?.ready ? "text-emerald-400" : "text-zinc-500"}`}>{p ? (p.ready ? "Ready" : "Not ready") : "Empty slot"}</div>
              </div>
            );
          })}
        </div>
        <button
          onClick={() => setReady(!me?.ready)}
          disabled={!me}
          className={`w-full rounded-xl py-3 font-semibold ${me?.ready ? "bg-zinc-800" : "bg-emerald-600 hover:bg-emerald-500"} disabled:opacity-40`}
        >
          {!me ? "Connecting…" : me.ready ? "Not Ready" : "Ready Up"}
        </button>
        {state.config && (
          <div className="mt-6 text-xs text-zinc-400 grid grid-cols-2 gap-2">
            <div>Universe: {state.config.universe}</div>
            <div>Rounds: {state.config.rounds}</div>
            <div>Timer: {state.config.roundTimer}s</div>
            <div>HP: {state.config.startingHp}</div>
            <div>Timeframe: {state.config.timeframe}</div>
            <div>Date hidden: {state.config.anonymizeDate ? "yes" : "no"} · Price hidden: {state.config.anonymizePrice ? "yes" : "no"}</div>
          </div>
        )}
      </Shell>
    );
  }

  // ENDED
  if (state.phase === "ended") {
    const won = state.matchResult?.winner === state.playerId;
    return (
      <Shell>
        <h1 className={`text-3xl font-bold text-center ${won ? "text-emerald-400" : "text-rose-400"}`}>
          {state.matchResult?.winner == null ? "Draw" : won ? "You Win!" : "You Lose"}
        </h1>
        <div className="mt-6 text-center text-zinc-300">
          {me && <div>{me.name}: {state.matchResult?.finalHp?.[me.id] ?? 0} HP</div>}
          {opp && <div>{opp.name}: {state.matchResult?.finalHp?.[opp.id] ?? 0} HP</div>}
        </div>
        <button onClick={() => window.location.href = "/"} className="mt-8 w-full bg-emerald-600 hover:bg-emerald-500 rounded-xl py-3 font-semibold">Home</button>
      </Shell>
    );
  }

  // PLAYING or ROUND END
  const round = state.round;
  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-4">
        <div className="text-sm text-zinc-400">Round {round?.index}/{round?.total}</div>
        <div className="flex-1 flex gap-4">
          {me && <HpBar name={me.name} hp={hpOf(me.id)} max={maxHp} me />}
          {opp && <HpBar name={opp.name} hp={hpOf(opp.id)} max={maxHp} me={false} />}
        </div>
        <div className="text-sm text-zinc-400">{state.phase === "playing" ? "Guess!" : "Round over"}</div>
      </div>

      <div className="flex-1 p-2">
        {round && <ChartView candles={round.window} anonymizeDate={round.anonymize.date} anonymizePrice={round.anonymize.price} />}
      </div>

      <div className="px-4 py-3 border-t border-zinc-800">
        {state.myGuess ? (
          <div className="text-center text-zinc-300 text-sm">Your guess: <span className="text-emerald-400 font-semibold">{state.myGuess}</span> — waiting…</div>
        ) : (
          <TickerAutocomplete universe={state.config?.universe || "Dow 30"} disabled={state.phase !== "playing"} onSubmit={submitGuess} />
        )}
      </div>

      {state.phase === "roundEnd" && state.roundResult && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md w-full text-center">
            <div className="text-zinc-400 text-sm">Correct ticker</div>
            <div className="text-3xl font-bold text-emerald-400 my-2">{state.roundResult.correctTicker}</div>
            <div className="space-y-1 text-sm mt-4">
              {state.roundResult.guesses.map((g: any) => {
                const p = state.players.find((x) => x.id === g.id);
                const dmg = state.roundResult!.damage[g.id] || 0;
                return (
                  <div key={g.id} className="flex justify-between">
                    <span>{p?.name}</span>
                    <span className={g.guess === state.roundResult!.correctTicker ? "text-emerald-400" : "text-rose-400"}>
                      {g.guess || "—"} · {dmg} dmg
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="text-zinc-500 text-xs mt-6">Next round in 5s…</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6"><div className="w-full max-w-lg">{children}</div></main>;
}
