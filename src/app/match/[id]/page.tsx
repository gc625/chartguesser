"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useMatch } from "@/lib/useMatch";
import ChartView from "@/components/ChartView";
import TickerAutocomplete from "@/components/TickerAutocomplete";
import ErrorBoundary from "@/components/ErrorBoundary";
import TickerPreview from "@/components/TickerPreview";

export default function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [entered, setEntered] = useState(false);

  useEffect(() => { params.then((p) => setId(p.id)); }, [params]);
  useEffect(() => {
    if (!id) return;
    const savedName = window.localStorage.getItem(`chartguesser:session:${id}:name`);
    if (!savedName) return;
    const restore = window.setTimeout(() => { setName(savedName); setEntered(true); }, 0);
    return () => window.clearTimeout(restore);
  }, [id]);

  if (!id) return <div className="min-h-dvh bg-[#080a12]" />;
  if (!entered) {
    return (
      <main className="app-shell flex min-h-dvh items-center justify-center px-5">
        <div className="panel w-full max-w-sm p-6 sm:p-8">
          <p className="eyebrow">Private match</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Ready to read the chart?</h1>
          <p className="mt-2 text-sm text-slate-400">Choose a name. We’ll remember it if you return to this match.</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" autoFocus maxLength={20}
            className="field mt-6" onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) setEntered(true); }} />
          <button disabled={!name.trim()} onClick={() => setEntered(true)} className="primary-button mt-3 w-full">Join match</button>
        </div>
      </main>
    );
  }
  return <ErrorBoundary><Game matchId={id} displayName={name.trim()} /></ErrorBoundary>;
}

function HpBar({ name, hp, max, me }: { name: string; hp: number; max: number; me: boolean }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  return <div className="min-w-0 flex-1">
    <div className="mb-1.5 flex justify-between gap-3 text-xs">
      <span className={`truncate font-medium ${me ? "text-cyan-200" : "text-slate-300"}`}>{name}{me ? " · YOU" : ""}</span>
      <span className="shrink-0 font-mono text-slate-300">{hp}<span className="text-slate-600">/{max}</span></span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full transition-[width] duration-500 ${me ? "bg-cyan-400" : "bg-fuchsia-500"}`} style={{ width: `${pct}%` }} /></div>
  </div>;
}

function useDeadline(deadline: number | null) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    const update = () => setLeft(Math.max(0, deadline - Date.now()));
    update(); const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [deadline]);
  return left;
}

function RoundTimer({ endsAt, active }: { endsAt?: number; active: boolean }) {
  const left = useDeadline(active ? endsAt ?? null : null);
  const seconds = Math.ceil(left / 1000);
  return <span className={`rounded-full border px-2 py-1 font-mono text-xs ${seconds <= 10 ? "border-rose-400/40 bg-rose-500/10 text-rose-300" : "border-slate-700 bg-slate-900 text-slate-300"}`}>{seconds}s</span>;
}

function IntermissionCountdown({ deadline }: { deadline: number | null }) {
  const left = useDeadline(deadline);
  const total = 5000;
  const pct = Math.max(0, Math.min(100, ((total - left) / total) * 100));
  return <div className="mx-auto mt-6 grid size-20 place-items-center rounded-full" style={{ background: `conic-gradient(#22d3ee ${pct}%, #1e293b ${pct}%)` }}>
    <div className="grid size-[68px] place-items-center rounded-full bg-slate-950"><span className="font-mono text-lg">{Math.ceil(left / 1000)}</span></div>
  </div>;
}

const CHART_RANGES = ["1M", "YTD", "1Y", "5Y"] as const;
type ChartRange = typeof CHART_RANGES[number];

function candlesForRange(candles: import("@/lib/useMatch").WindowCandle[], range: ChartRange) {
  if (!candles.length || range === "5Y") return candles;
  const latest = new Date(candles[candles.length - 1].t);
  const cutoff = new Date(latest);
  if (range === "1M") cutoff.setMonth(cutoff.getMonth() - 1);
  if (range === "YTD") cutoff.setMonth(0, 1);
  if (range === "YTD") cutoff.setHours(0, 0, 0, 0);
  if (range === "1Y") cutoff.setFullYear(cutoff.getFullYear() - 1);
  return candles.filter((c) => c.t >= cutoff.getTime());
}

function Game({ matchId, displayName }: { matchId: string; displayName: string }) {
  const { state, setReady, submitGuess, setRematchReady } = useMatch(matchId, displayName);
  const [chartRange, setChartRange] = useState<ChartRange>("1Y");
  const [copied, setCopied] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "shared" | "copied">("idle");
  const me = state.players.find((p) => p.id === state.playerId);
  const opp = state.players.find((p) => p.id !== state.playerId);
  const maxHp = state.config?.startingHp || 100;
  const hpOf = (pid: string | null) => pid
    ? (state.roundResult?.hp?.[pid] ?? state.round?.hp?.[pid] ?? maxHp)
    : 0;

  const round = state.round;
  const isUnlimited = state.config?.guessMode === "unlimited";

  async function copyLink() {
    const link = window.location.href;
    try { await navigator.clipboard.writeText(link); }
    catch {
      const textarea = document.createElement("textarea");
      textarea.value = link; textarea.style.position = "fixed"; textarea.style.opacity = "0";
      document.body.appendChild(textarea); textarea.select(); document.execCommand("copy"); textarea.remove();
    }
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }

  async function shareResult() {
    if (!state.matchResult || !me || !opp) return;
    const tilesFor = (playerId: string) => state.matchResult!.shareRounds.map((round) => {
      if (round.correctPlayerIds.includes(playerId)) return "🟩";
      if (round.attemptedPlayerIds.includes(playerId)) return "🟥";
      return "⬛";
    }).join("");
    const text = [
      `ChartGuesser ⚔️ ${state.matchResult.roundsWon[me.id] ?? 0}–${state.matchResult.roundsWon[opp.id] ?? 0}`,
      `You       ${tilesFor(me.id)}`,
      `Opponent  ${tilesFor(opp.id)}`,
      "",
      "Think you can read the chart?",
    ].join("\n");
    const shareData = { title: "My ChartGuesser result", text, url: window.location.origin };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setShareStatus("shared");
        window.setTimeout(() => setShareStatus("idle"), 1800);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    const shareText = `${text}\n${window.location.origin}`;
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = shareText; textarea.style.position = "fixed"; textarea.style.opacity = "0";
      document.body.appendChild(textarea); textarea.select(); document.execCommand("copy"); textarea.remove();
    }
    setShareStatus("copied");
    window.setTimeout(() => setShareStatus("idle"), 1800);
  }

  if (state.error && state.phase === "lobby") {
    return <Shell>
      <div className="panel p-6 text-center sm:p-8">
        <div role="alert" className="text-rose-400">{state.error}</div>
        {state.error === "Match not found" && (
          <Link href="/" className="primary-button mt-5 inline-flex w-full items-center justify-center">
            Create a new match
          </Link>
        )}
      </div>
    </Shell>;
  }

  // LOBBY
  if (state.phase === "lobby") {
    return (
      <Shell>
        <div className="panel p-5 sm:p-7">
        <p className="eyebrow">Match lobby</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Bring your opponent in.</h1>
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-950/70 p-2">
          <span className="min-w-0 flex-1 truncate px-2 text-xs text-slate-400">{typeof window !== "undefined" ? window.location.href : ""}</span>
          <button onClick={copyLink} className="secondary-button shrink-0 px-3 py-2 text-xs">{copied ? "Copied!" : "Copy link"}</button>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          {[0, 1].map((i) => {
            const p = state.players[i];
            return (
              <div key={i} className={`min-w-0 rounded-2xl border p-4 ${p ? "border-cyan-400/30 bg-cyan-400/[.06]" : "border-dashed border-slate-700 bg-slate-900/40"}`}>
                <div className="text-lg font-semibold truncate">{p ? p.name : "Waiting…"}</div>
                <div className={`mt-1 text-sm ${p?.ready ? "text-cyan-300" : "text-slate-500"}`}>{p ? (p.ready ? "Ready" : p.connected === false ? "Reconnecting…" : "Not ready") : "Empty slot"}</div>
              </div>
            );
          })}
        </div>
        <button
          onClick={() => setReady(!me?.ready)}
          disabled={!me}
          className={`mt-5 w-full ${me?.ready ? "secondary-button" : "primary-button"} disabled:opacity-40`}
        >
          {!me ? "Connecting…" : me.ready ? "Not Ready" : "Ready Up"}
        </button>
        {state.config && (
          <>
            <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-950/70 p-3 text-xs text-slate-400">
              <div>{state.config.universe}</div><div>{state.config.rounds} rounds</div>
              <div>{state.config.roundTimer}s per round</div><div>{state.config.startingHp} starting HP</div>
              <div className="col-span-2">{state.config.guessMode === "single" ? "One guess each" : `Unlimited guesses · −${state.config.wrongGuessPenalty} HP wrong guess`}</div>
            </div>
            <div className="mt-3">
              <TickerPreview tickers={state.config.tickers || state.config.customTickers} title="Exact match ticker pool" />
            </div>
          </>
        )}
        </div>
      </Shell>
    );
  }

  // ENDED
  if (state.phase === "ended") {
    const won = state.matchResult?.winner === state.playerId;
    return (
      <Shell>
        <div className="panel p-6 text-center sm:p-8">
        <p className="eyebrow">Match complete</p>
        <h1 className={`mt-2 text-4xl font-semibold tracking-tight ${won ? "text-cyan-300" : "text-fuchsia-300"}`}>
          {state.matchResult?.winner == null ? "Draw" : won ? "You Win!" : "You Lose"}
        </h1>
        <div className="mt-6 space-y-2 text-left">
          {[me, opp].filter(Boolean).map((p) => p && <div key={p.id} className="flex items-center justify-between rounded-xl bg-slate-900/80 px-4 py-3 text-sm"><span>{p.name}{p.id === me?.id ? " · You" : ""}</span><span className="font-mono text-slate-300">{state.matchResult?.finalHp?.[p.id] ?? 0} HP · {state.matchResult?.roundsWon?.[p.id] ?? 0} wins</span></div>)}
        </div>
        {me && opp && state.matchResult && (
          <div className="mt-5 rounded-xl border border-slate-700/70 bg-slate-950/70 p-4 text-left">
            <div className="flex items-center justify-between gap-3">
              <span className="eyebrow">Your result</span>
              <span className="text-xs text-slate-500">🟩 correct · 🟥 missed · ⬛ skipped</span>
            </div>
            {[me, opp].map((player) => (
              <div key={player.id} className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-400">{player.id === me.id ? "You" : "Opponent"}</span>
                <span className="font-mono tracking-wider" aria-label={`${player.id === me.id ? "Your" : "Opponent's"} round results`}>
                  {state.matchResult!.shareRounds.map((round) => round.correctPlayerIds.includes(player.id) ? "🟩" : round.attemptedPlayerIds.includes(player.id) ? "🟥" : "⬛").join("")}
                </span>
              </div>
            ))}
            <button onClick={shareResult} className="secondary-button mt-4 w-full">
              {shareStatus === "shared" ? "Shared!" : shareStatus === "copied" ? "Copied result!" : "Share result"}
            </button>
          </div>
        )}
        <button onClick={() => setRematchReady(!state.rematchReady[state.playerId || ""])} className="primary-button mt-6 w-full">{state.rematchReady[state.playerId || ""] ? "Waiting for opponent…" : "Play again"}</button>
        <p className="mt-2 text-xs text-slate-500">Both players must choose play again.</p>
        <button onClick={() => window.location.href = "/"} className="mt-4 text-sm text-slate-400 underline underline-offset-4">Return home</button>
        </div>
      </Shell>
    );
  }

  // PLAYING or ROUND END
  return (
    <div className="app-shell relative min-h-dvh text-slate-100 md:h-dvh md:overflow-hidden">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-slate-800/80 bg-[#0b0f1c]/90 px-3 py-3 backdrop-blur-xl md:shrink-0">
        <span className="font-semibold tracking-tight">Chart<span className="text-cyan-300">Guesser</span></span>
        <span className="rounded-full bg-slate-900 px-2 py-1 text-xs text-slate-400">Round {round?.index}/{round?.total}</span>
        <RoundTimer endsAt={round?.endsAt} active={state.phase === "playing"} />
        <span className="ml-auto max-w-[35vw] truncate text-xs text-slate-500">{state.config?.universe} · {chartRange}</span>
        <span className={`size-2 rounded-full ${state.connected ? "bg-cyan-400 shadow-[0_0_10px_#22d3ee]" : "bg-rose-400"}`} title={state.connected ? "Connected" : "Reconnecting"} />
      </header>

      <main className="md:flex-1 md:flex md:min-h-0">
        <section className="relative h-[52svh] min-h-[290px] w-full p-2 sm:h-[58svh] md:h-auto md:min-h-0 md:min-w-0 md:flex-1">
          {round ? (
            <>
              <div className="absolute left-4 top-4 z-10 flex rounded-xl border border-slate-700/80 bg-slate-950/90 p-1 shadow-lg backdrop-blur">
                {CHART_RANGES.map((range) => (
                  <button
                    key={range}
                    onClick={() => setChartRange(range)}
                    className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition-colors ${chartRange === range ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"}`}
                  >
                    {range}
                  </button>
                ))}
              </div>
              <ChartView candles={candlesForRange(round.window, chartRange)} anonymizeDate={round.anonymize.date} anonymizePrice={round.anonymize.price} />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
              <div className="flex flex-col items-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-cyan-400" />
                Loading chart…
              </div>
            </div>
          )}
        </section>

        <aside className="w-full border-t border-slate-800 bg-slate-950/60 md:flex md:min-h-0 md:w-80 md:shrink-0 md:flex-col md:border-l md:border-t-0 lg:w-96">
          <div className="space-y-3 border-b border-slate-800 p-4 md:shrink-0">
            {me && <HpBar name={me.name} hp={hpOf(me.id)} max={maxHp} me />}
            {opp && <HpBar name={opp.name} hp={hpOf(opp.id)} max={maxHp} me={false} />}
          </div>

          <div className="border-b border-slate-800 p-4 md:shrink-0">
            {state.myGuessLocked ? (
              <div className="rounded-xl bg-cyan-400/10 py-3 text-center text-sm text-cyan-100">
                Guess locked: <span className="font-semibold">{state.myGuess}</span>
              </div>
            ) : (
              <><TickerAutocomplete universe={state.config?.universe || "Dow 30"} customTickers={state.config?.tickers || state.config?.customTickers} disabled={state.phase !== "playing"} onSubmit={submitGuess} />
              {isUnlimited && <p className="mt-2 text-xs text-slate-500">Wrong guesses cost {state.config?.wrongGuessPenalty} HP. Tickers stay hidden until results.</p>}</>
            )}
          </div>

          <div className="px-4 py-3 text-xs font-medium uppercase tracking-[.16em] text-slate-500 md:shrink-0">{isUnlimited ? "Guess activity" : "Guesses"}</div>
          <div className="max-h-72 space-y-2 overflow-y-auto px-4 pb-6 md:max-h-none md:min-h-0 md:flex-1">
            {!isUnlimited && state.guesses.length === 0 && (
              <div className="text-sm italic text-slate-600">No guesses yet…</div>
            )}
            {!isUnlimited && state.guesses.map((g, i) => {
              const mine = g.playerId === state.playerId;
              return (
                <div key={i} className={`flex min-w-0 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${mine ? "border-cyan-400/20 bg-cyan-400/[.06]" : "border-slate-700 bg-slate-900/70"}`}>
                  <span className="truncate text-slate-300">{g.name}{mine ? " (you)" : ""}</span>
                  <span className="shrink-0 text-xs text-slate-500">Submitted</span>
                </div>
              );
            })}
            {isUnlimited && state.players.map((p) => <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm"><span>{p.name}{p.id === me?.id ? " · You" : ""}</span><span className="font-mono text-slate-500">{state.guessActivity[p.id] || 0} submitted</span></div>)}
          </div>
        </aside>
      </main>

      {state.phase === "roundEnd" && state.roundResult && (
        <div className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="panel my-auto w-full max-w-md p-5 text-center sm:p-8">
            <div className="eyebrow">Correct ticker</div>
            <div className="my-2 text-4xl font-semibold tracking-tight text-cyan-300">{state.roundResult.correctTicker}</div>
            <div className="mt-5 space-y-3 text-left text-sm">
              {state.roundResult.guesses.map((g: { id: string; history: { guess: string; correct: boolean; penalty: number }[] }) => {
                const p = state.players.find((x) => x.id === g.id);
                const dmg = state.roundResult!.damage[g.id] || 0;
                return (
                  <div key={g.id} className="rounded-xl bg-slate-900/70 p-3">
                    <div className="flex justify-between"><span>{p?.name}</span><span className="font-mono text-cyan-300">{dmg ? `${dmg} dmg` : "—"}</span></div>
                    <div className="mt-2 flex flex-wrap gap-1.5">{g.history.map((entry, i) => <span key={i} className={`rounded-md px-2 py-1 font-mono text-xs ${entry.correct ? "bg-cyan-400/15 text-cyan-200" : "bg-rose-400/10 text-rose-200"}`}>{entry.guess}{entry.penalty ? ` −${entry.penalty}` : ""}</span>)}</div>
                  </div>
                );
              })}
            </div>
            {state.roundResult.nextRoundAt && <><IntermissionCountdown deadline={state.roundResult.nextRoundAt} /><div className="mt-3 text-xs text-slate-500">Preparing the next chart</div></>}
          </div>
        </div>
      )}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="app-shell flex min-h-dvh items-start justify-center px-4 py-8 sm:items-center sm:p-6"><div className="w-full max-w-lg">{children}</div></main>;
}
