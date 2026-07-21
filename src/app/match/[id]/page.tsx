"use client";
import { useState, useEffect } from "react";
import { useMatch } from "@/lib/useMatch";
import ChartView from "@/components/ChartView";
import TickerAutocomplete from "@/components/TickerAutocomplete";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [entered, setEntered] = useState(false);

  useEffect(() => { params.then((p) => setId(p.id)); }, [params]);

  if (!id) return <div className="min-h-dvh bg-zinc-950" />;
  if (!entered) {
    return (
      <main className="min-h-dvh bg-zinc-950 text-zinc-100 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold text-center">Join Match</h1>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Display name"
            className="w-full min-h-12 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2"
            onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) setEntered(true); }}
          />
          <button
            disabled={!name.trim()} onClick={() => setEntered(true)}
            className="w-full min-h-12 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-lg py-2 font-semibold"
          >
            Join
          </button>
        </div>
      </main>
    );
  }
  return <ErrorBoundary><Game matchId={id} displayName={name.trim()} /></ErrorBoundary>;
}

function HpBar({ name, hp, max, me }: { name: string; hp: number; max: number; me: boolean }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  return (
    <div className="min-w-0 flex-1">
      <div className="flex justify-between gap-3 text-xs mb-1">
        <span className={`truncate ${me ? "text-emerald-400 font-semibold" : "text-zinc-300"}`}>{name}{me ? " (you)" : ""}</span>
        <span className="shrink-0">{hp}/{max}</span>
      </div>
      <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${me ? "bg-emerald-500" : "bg-rose-500"} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RoundTimer({ seconds, active }: { seconds: number; active: boolean }) {
  const [timeLeft, setTimeLeft] = useState(seconds);

  useEffect(() => {
    if (!active) return;
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setTimeLeft(Math.max(0, seconds - elapsed));
    }, 250);
    return () => clearInterval(interval);
  }, [active, seconds]);

  return (
    <span className={`text-xs font-mono ${timeLeft <= 10 ? "text-rose-400" : "text-zinc-400"}`}>
      {timeLeft}s
    </span>
  );
}

function Game({ matchId, displayName }: { matchId: string; displayName: string }) {
  const { state, setReady, submitGuess } = useMatch(matchId, displayName);
  const me = state.players.find((p) => p.id === state.playerId);
  const opp = state.players.find((p) => p.id !== state.playerId);
  const maxHp = state.config?.startingHp || 100;
  const hpOf = (pid: string | null) => pid
    ? (state.roundResult?.hp?.[pid] ?? state.round?.hp?.[pid] ?? maxHp)
    : 0;

  const round = state.round;

  if (state.error && state.phase === "lobby") {
    return <Shell><div className="text-center text-rose-400">{state.error}</div></Shell>;
  }

  // LOBBY
  if (state.phase === "lobby") {
    return (
      <Shell>
        <h1 className="text-2xl font-bold mb-1">Lobby</h1>
        <p className="text-zinc-400 text-sm mb-6">Share this link: <span className="text-emerald-400 select-all break-all">{typeof window !== "undefined" ? window.location.href : ""}</span></p>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 sm:gap-4 mb-6">
          {[0, 1].map((i) => {
            const p = state.players[i];
            return (
              <div key={i} className={`min-w-0 p-4 sm:p-5 rounded-xl border ${p ? "border-emerald-700 bg-zinc-900" : "border-dashed border-zinc-700 bg-zinc-900/40"}`}>
                <div className="text-lg font-semibold truncate">{p ? p.name : "Waiting…"}</div>
                <div className={`text-sm mt-1 ${p?.ready ? "text-emerald-400" : "text-zinc-500"}`}>{p ? (p.ready ? "Ready" : "Not ready") : "Empty slot"}</div>
              </div>
            );
          })}
        </div>
        <button
          onClick={() => setReady(!me?.ready)}
          disabled={!me}
          className={`w-full min-h-12 rounded-xl py-3 font-semibold ${me?.ready ? "bg-zinc-800" : "bg-emerald-600 hover:bg-emerald-500"} disabled:opacity-40`}
        >
          {!me ? "Connecting…" : me.ready ? "Not Ready" : "Ready Up"}
        </button>
        {state.config && (
          <div className="mt-6 text-xs text-zinc-400 grid grid-cols-1 min-[380px]:grid-cols-2 gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
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
  return (
    <div className="relative min-h-dvh bg-zinc-950 text-zinc-100 md:h-dvh md:flex md:flex-col md:overflow-hidden">
      <header className="sticky top-0 z-10 px-3 py-2 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur flex flex-wrap items-center gap-x-3 gap-y-1 md:shrink-0">
        <span className="font-semibold text-sm">ChartGuesser</span>
        <span className="text-xs text-zinc-500">·</span>
        <span className="text-xs text-zinc-400">Round {round?.index}/{round?.total}</span>
        <span className="text-xs text-zinc-500">·</span>
        <RoundTimer key={round?.index ?? 0} seconds={round?.timeLimit ?? 0} active={state.phase === "playing"} />
        <span className="ml-auto text-xs text-zinc-500 truncate max-w-[45vw]">{state.config?.universe} · {state.config?.timeframe}</span>
        <span className={`size-2 rounded-full ${state.connected ? "bg-emerald-500" : "bg-rose-500"}`} title={state.connected ? "Connected" : "Disconnected"} />
      </header>

      <main className="md:flex-1 md:flex md:min-h-0">
        <section className="relative h-[58svh] min-h-[340px] w-full p-2 md:h-auto md:min-h-0 md:min-w-0 md:flex-1">
          {round ? (
            <ChartView candles={round.window} anonymizeDate={round.anonymize.date} anonymizePrice={round.anonymize.price} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm">
              <div className="flex flex-col items-center gap-2">
                <div className="h-6 w-6 border-2 border-zinc-600 border-t-emerald-500 rounded-full animate-spin" />
                Loading chart…
              </div>
            </div>
          )}
        </section>

        <aside className="w-full border-t border-zinc-800 bg-zinc-900/40 md:flex md:min-h-0 md:w-80 md:shrink-0 md:flex-col md:border-l md:border-t-0 lg:w-96">
          <div className="p-3 space-y-3 border-b border-zinc-800 md:shrink-0">
            {me && <HpBar name={me.name} hp={hpOf(me.id)} max={maxHp} me />}
            {opp && <HpBar name={opp.name} hp={hpOf(opp.id)} max={maxHp} me={false} />}
          </div>

          <div className="p-3 border-b border-zinc-800 md:shrink-0">
            {state.myGuess ? (
              <div className="text-center text-zinc-300 text-sm py-2">
                Your guess: <span className="text-emerald-400 font-semibold">{state.myGuess}</span> — locked in
              </div>
            ) : (
              <TickerAutocomplete universe={state.config?.universe || "Dow 30"} disabled={state.phase !== "playing"} onSubmit={submitGuess} />
            )}
          </div>

          <div className="px-3 py-2 text-xs uppercase tracking-wide text-zinc-500 md:shrink-0">Guesses</div>
          <div className="max-h-72 overflow-y-auto px-3 pb-6 space-y-2 md:max-h-none md:min-h-0 md:flex-1">
            {state.guesses.length === 0 && (
              <div className="text-sm text-zinc-600 italic">No guesses yet…</div>
            )}
            {state.guesses.map((g, i) => {
              const mine = g.playerId === state.playerId;
              return (
                <div key={i} className={`flex min-w-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${mine ? "bg-emerald-900/30 border border-emerald-800/50" : "bg-zinc-800/50 border border-zinc-700/50"}`}>
                  <span className="truncate text-zinc-300">{g.name}{mine ? " (you)" : ""}</span>
                  <span className="shrink-0 font-mono font-semibold">{g.guess}</span>
                </div>
              );
            })}
          </div>
        </aside>
      </main>

      {state.phase === "roundEnd" && state.roundResult && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center overflow-y-auto p-4 z-30">
          <div className="my-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8 max-w-md w-full text-center">
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
  return <main className="min-h-dvh bg-zinc-950 text-zinc-100 flex items-start sm:items-center justify-center px-4 py-8 sm:p-6"><div className="w-full max-w-lg">{children}</div></main>;
}
