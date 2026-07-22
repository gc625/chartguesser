import { sampleCurrentWindow, type Candle } from "./chart";
import { CUSTOM_UNIVERSE, getUniverse } from "./universes";
import { randomUUID } from "crypto";

export type MatchConfig = {
  universe: string;
  rounds: number;
  roundTimer: number; // seconds
  startingHp: number;
  customTickers: string[];
  guessMode: "single" | "unlimited";
  wrongGuessPenalty: number;
  anonymizeDate: boolean;
  anonymizePrice: boolean;
  timeframe: string;
};

export type RoundGuess = {
  guess: string;
  guessAt: number;
  correct: boolean;
  penalty: number;
};

export type Player = {
  id: string;
  sessionId: string;
  name: string;
  ready: boolean;
  hp: number;
  ws: any | null;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
  guess: string | null;
  guessAt: number | null;
  correctTime: number | null; // seconds to correct, null if wrong/no guess
  guesses: RoundGuess[];
  totalCorrectTime: number;
  roundsWon: number;
  rematch: boolean;
};

export type Match = {
  id: string;
  config: MatchConfig;
  players: Player[];
  state: "lobby" | "playing" | "roundEnd" | "ended";
  roundIndex: number;
  current: { ticker: string; candles: Candle[]; startedAt: number } | null;
  timer: any;
  intermission: any;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  roundResult: any | null;
  matchResult: any | null;
  shareRounds: { correctPlayerIds: string[]; attemptedPlayerIds: string[] }[];
};

export const MAX_DAMAGE = 35;
// Mobile players commonly leave a tab while switching apps; preserve their slot
// long enough for a realistic return on the same browser.
const DISCONNECT_GRACE_MS = 30 * 60 * 1000;
const EMPTY_MATCH_TTL_MS = 30 * 60 * 1000;
const ENDED_MATCH_TTL_MS = 15 * 60 * 1000;

const matches: Map<string, Match> = (globalThis as any).__cg_matches ??= new Map();

export function createMatch(config: MatchConfig): Match {
  const id = randomUUID().replaceAll("-", "").slice(0, 10);
  const m: Match = {
    id, config, players: [], state: "lobby", roundIndex: 0, current: null,
    timer: null, intermission: null, cleanupTimer: null,
    roundResult: null, matchResult: null, shareRounds: [],
  };
  matches.set(id, m);
  scheduleCleanup(m, EMPTY_MATCH_TTL_MS);
  return m;
}

export function getMatch(id: string): Match | undefined {
  return matches.get(id);
}

function scheduleCleanup(m: Match, delay: number) {
  if (m.cleanupTimer) clearTimeout(m.cleanupTimer);
  m.cleanupTimer = setTimeout(() => {
    if (m.players.some((p) => p.ws?.readyState === 1)) {
      scheduleCleanup(m, EMPTY_MATCH_TTL_MS);
      return;
    }
    matches.delete(m.id);
  }, delay);
  m.cleanupTimer.unref?.();
}

export function joinPlayer(
  m: Match,
  ws: any,
  name: string,
  sessionId: string,
): { player: Player; reconnected: boolean } | null {
  const existing = m.players.find((p) => p.sessionId === sessionId);
  if (existing) {
    if (existing.disconnectTimer) clearTimeout(existing.disconnectTimer);
    existing.disconnectTimer = null;
    if (existing.ws && existing.ws !== ws) existing.ws.close();
    existing.ws = ws;
    return { player: existing, reconnected: true };
  }
  if (m.state !== "lobby" || m.players.length >= 2) return null;
  const p: Player = {
    id: randomUUID().replaceAll("-", "").slice(0, 8),
    sessionId,
    name: name.slice(0, 20) || "Player",
    ready: false, hp: m.config.startingHp, ws, disconnectTimer: null,
    guess: null, guessAt: null, correctTime: null, guesses: [],
    totalCorrectTime: 0, roundsWon: 0, rematch: false,
  };
  m.players.push(p);
  return { player: p, reconnected: false };
}

function send(p: Player, type: string, payload: any) {
  if (p.ws?.readyState === 1) p.ws.send(JSON.stringify({ type, payload }));
}

function broadcast(m: Match, type: string, payload: any) {
  m.players.forEach((p) => send(p, type, payload));
}

function lobbyState(m: Match) {
  return {
    players: m.players.map((p) => ({
      id: p.id, name: p.name, ready: p.ready, connected: p.ws?.readyState === 1,
    })),
    config: m.config,
  };
}

function anonymize(candles: Candle[], m: Match): any[] {
  const { anonymizeDate, anonymizePrice } = m.config;
  let min = Infinity, max = -Infinity;
  candles.forEach((c) => { if (c.l < min) min = c.l; if (c.h > max) max = c.h; });
  return candles.map((c, i) => {
    const norm = (x: number) => (anonymizePrice && max > min ? ((x - min) / (max - min)) * 100 : x);
    return {
      i: anonymizeDate ? i : c.t,
      t: c.t,
      o: norm(c.o), h: norm(c.h), l: norm(c.l), c: norm(c.c),
      v: anonymizePrice ? c.v : c.v,
    };
  });
}

async function startRound(m: Match) {
  m.roundIndex++;
  if (m.roundIndex > m.config.rounds) return endMatch(m);
  m.state = "playing";
  m.roundResult = null;
  m.players.forEach((p) => { p.guess = null; p.guessAt = null; p.correctTime = null; p.guesses = []; });
  try {
    const universe = m.config.universe === CUSTOM_UNIVERSE
      ? m.config.customTickers
      : await getUniverse(m.config.universe);
    const { ticker, candles } = await sampleCurrentWindow(universe);
    m.current = { ticker, candles, startedAt: Date.now() };
    broadcast(m, "roundStart", {
      window: anonymize(candles, m),
      timeframe: "Daily",
      anonymize: { date: m.config.anonymizeDate, price: m.config.anonymizePrice },
      roundIndex: m.roundIndex,
      totalRounds: m.config.rounds,
      timeLimit: m.config.roundTimer,
      startedAt: m.current.startedAt,
      endsAt: m.current.startedAt + m.config.roundTimer * 1000,
      hp: hpMap(m),
    });
    m.timer = setTimeout(() => endRound(m), m.config.roundTimer * 1000);
  } catch (e) {
    broadcast(m, "error", { message: "Failed to load chart data" });
    endMatch(m);
  }
}

function hpMap(m: Match) {
  const o: any = {};
  m.players.forEach((p) => (o[p.id] = p.hp));
  return o;
}

function endRound(m: Match) {
  if (m.state !== "playing") return;
  if (m.timer) clearTimeout(m.timer);
  m.state = "roundEnd";
  const correct = m.current?.ticker;
  const damage: Record<string, number> = {};
  m.players.forEach((p) => {
    if (p.guess === correct && p.guessAt != null) {
      const secs = (p.guessAt - m.current!.startedAt) / 1000;
      p.correctTime = secs;
      p.totalCorrectTime += secs;
      const dmg = Math.round(((m.config.roundTimer - secs) / m.config.roundTimer) * MAX_DAMAGE);
      damage[p.id] = Math.max(0, dmg);
    } else {
      damage[p.id] = 0;
    }
  });
  // apply damage to opponents of correct guessers
  m.players.forEach((p) => {
    if (damage[p.id] > 0) {
      m.players.forEach((o) => { if (o.id !== p.id) o.hp = Math.max(0, o.hp - damage[p.id]); });
    }
  });
  const roundWinners = m.players.filter((p) => damage[p.id] > 0);
  roundWinners.forEach((p) => { p.roundsWon++; });
  m.shareRounds.push({
    correctPlayerIds: roundWinners.map((p) => p.id),
    attemptedPlayerIds: m.players.filter((p) => p.guesses.length > 0).map((p) => p.id),
  });
  const ko = m.players.find((p) => p.hp <= 0);
  const nextRoundAt = Date.now() + 5000;
  m.roundResult = {
    correctTicker: correct,
    guesses: m.players.map((p) => ({
      id: p.id, guess: p.guess, guessAt: p.guessAt, correctTime: p.correctTime,
      history: p.guesses,
    })),
    damage,
    hp: hpMap(m),
    winner: roundWinners[0]?.id || null,
    nextRoundAt: ko ? null : nextRoundAt,
  };
  broadcast(m, "roundEnd", m.roundResult);
  if (ko) return endMatch(m);
  m.intermission = setTimeout(() => startRound(m), Math.max(0, nextRoundAt - Date.now()));
}

function endMatch(m: Match) {
  m.state = "ended";
  if (m.timer) clearTimeout(m.timer);
  if (m.intermission) clearTimeout(m.intermission);
  const winner = determineWinner(m);
  m.matchResult = {
    winner,
    finalHp: hpMap(m),
    roundsWon: m.players.reduce((a, p) => ({ ...a, [p.id]: p.roundsWon }), {} as Record<string, number>),
    totalTimeToCorrect: m.players.reduce((a, p) => ({ ...a, [p.id]: p.totalCorrectTime }), {} as Record<string, number>),
    shareRounds: m.shareRounds,
  };
  broadcast(m, "matchEnd", m.matchResult);
  scheduleCleanup(m, ENDED_MATCH_TTL_MS);
}

function determineWinner(m: Match): string | null {
  const alive = m.players.filter((p) => p.hp > 0);
  if (alive.length === 1) return alive[0].id;
  if (m.players.length < 2) return m.players[0]?.id ?? null;
  const [a, b] = m.players;
  if (a.hp !== b.hp) return a.hp > b.hp ? a.id : b.id;
  const ta = a.totalCorrectTime || Infinity, tb = b.totalCorrectTime || Infinity;
  return ta < tb ? a.id : tb < ta ? b.id : null;
}

export async function handleMessage(m: Match, p: Player, msg: any) {
  if (msg.type === "ready") {
    if (m.state !== "lobby") return;
    p.ready = !!msg.ready;
    console.log(`[match:${m.id}] ${p.name} ready=${p.ready} players=${m.players.length} allReady=${m.players.every((x) => x.ready)}`);
    broadcast(m, "readyState", lobbyState(m).players);
    if (m.players.length === 2 && m.players.every((x) => x.ready && x.ws?.readyState === 1)) {
      m.state = "playing";
      broadcast(m, "matchStart", { config: m.config });
      m.roundIndex = 0;
      console.log(`[match:${m.id}] matchStart -> starting round 1`);
      await startRound(m);
    }
  } else if (msg.type === "guess") {
    if (m.state !== "playing") return;
    if (p.guess != null) return;
    const guess = (msg.ticker || "").toUpperCase();
    const allowedTickers = m.config.universe === CUSTOM_UNIVERSE
      ? m.config.customTickers
      : await getUniverse(m.config.universe);
    if (!allowedTickers.includes(guess)) {
      send(p, "error", { message: "Choose a ticker from this match’s universe." });
      return;
    }
    const at = Date.now();
    const correct = m.current?.ticker;
    const isCorrect = guess === correct;
    const penalty = isCorrect ? 0 : m.config.wrongGuessPenalty;
    if (m.config.guessMode === "single" || isCorrect) {
      p.guess = guess;
      p.guessAt = at;
    }
    p.guesses.push({ guess, guessAt: at, correct: isCorrect, penalty });
    if (penalty) {
      p.hp = Math.max(0, p.hp - penalty);
      broadcast(m, "hpUpdate", { hp: hpMap(m), playerId: p.id, penalty });
    }
    send(p, "guessAck", { guess, locked: p.guess != null, penalty });
    if (m.config.guessMode === "single") {
      broadcast(m, "guessSubmitted", { playerId: p.id, name: p.name, guess, guessAt: at });
      if (m.players.every((x) => x.guess != null)) endRound(m);
    } else {
      broadcast(m, "guessActivity", { playerId: p.id, name: p.name, count: p.guesses.length });
    }
    if (p.hp <= 0) endRound(m);
  } else if (msg.type === "rematch") {
    if (m.state !== "ended") return;
    p.rematch = !!msg.ready;
    broadcast(m, "rematchState", {
      players: m.players.map((x) => ({ id: x.id, ready: x.rematch })),
    });
    if (m.players.length === 2 && m.players.every((x) => x.rematch && x.ws?.readyState === 1)) {
      if (m.cleanupTimer) clearTimeout(m.cleanupTimer);
      m.state = "lobby";
      m.roundIndex = 0;
      m.current = null;
      m.roundResult = null;
      m.matchResult = null;
      m.shareRounds = [];
      m.players.forEach((x) => {
        x.ready = false;
        x.rematch = false;
        x.hp = m.config.startingHp;
        x.guess = null;
        x.guessAt = null;
        x.correctTime = null;
        x.guesses = [];
        x.totalCorrectTime = 0;
        x.roundsWon = 0;
      });
      broadcast(m, "rematchLobby", lobbyState(m));
    }
  }
}

export function syncPlayer(m: Match, p: Player) {
  send(p, "joined", { playerId: p.id, matchId: m.id, reconnected: true });
  send(p, "playerJoined", lobbyState(m));
  if (m.state === "playing" && m.current) {
    const elapsed = (Date.now() - m.current.startedAt) / 1000;
    send(p, "matchStart", { config: m.config });
    send(p, "roundStart", {
      window: anonymize(m.current.candles, m),
      timeframe: "Daily",
      anonymize: { date: m.config.anonymizeDate, price: m.config.anonymizePrice },
      roundIndex: m.roundIndex,
      totalRounds: m.config.rounds,
      timeLimit: Math.max(0, Math.ceil(m.config.roundTimer - elapsed)),
      startedAt: m.current.startedAt,
      endsAt: m.current.startedAt + m.config.roundTimer * 1000,
      hp: hpMap(m),
    });
    m.players.forEach((x) => {
      if (m.config.guessMode === "single" && x.guess != null) {
        send(p, "guessSubmitted", { playerId: x.id, name: x.name, guess: x.guess, guessAt: x.guessAt });
      } else if (m.config.guessMode === "unlimited" && x.guesses.length) {
        send(p, "guessActivity", { playerId: x.id, name: x.name, count: x.guesses.length });
      }
    });
    if (p.guess) send(p, "guessAck", { guess: p.guess });
  } else if (m.state === "roundEnd" && m.roundResult) {
    send(p, "roundEnd", m.roundResult);
  } else if (m.state === "ended" && m.matchResult) {
    send(p, "matchEnd", m.matchResult);
  }
}

export function disconnectPlayer(m: Match, p: Player, ws: any) {
  // Ignore a close event from a socket that has already been replaced.
  if (p.ws !== ws) return;
  p.ws = null;
  if (m.state === "lobby") p.ready = false;
  const graceUntil = Date.now() + DISCONNECT_GRACE_MS;
  broadcast(m, "playerDisconnected", { playerId: p.id, graceUntil });
  if (m.state === "lobby") broadcast(m, "readyState", lobbyState(m).players);
  if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
  p.disconnectTimer = setTimeout(() => {
    if (p.ws) return;
    m.players = m.players.filter((x) => x !== p);
    broadcast(m, "playerLeft", lobbyState(m));
    if (m.state !== "lobby" && m.state !== "ended") endMatch(m);
  }, DISCONNECT_GRACE_MS);
  p.disconnectTimer.unref?.();
  if (m.state === "lobby") scheduleCleanup(m, EMPTY_MATCH_TTL_MS);
}
