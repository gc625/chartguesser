import { sampleWindow, type Candle } from "./chart";
import { getUniverse } from "./universes";

export type MatchConfig = {
  universe: string;
  rounds: number;
  roundTimer: number; // seconds
  startingHp: number;
  anonymizeDate: boolean;
  anonymizePrice: boolean;
  timeframe: string;
};

export type Player = {
  id: string;
  name: string;
  ready: boolean;
  hp: number;
  ws: any;
  guess: string | null;
  guessAt: number | null;
  correctTime: number | null; // seconds to correct, null if wrong/no guess
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
};

export const MAX_DAMAGE = 35;

const matches: Map<string, Match> = (globalThis as any).__cg_matches ??= new Map();

export function createMatch(config: MatchConfig): Match {
  const id = Math.random().toString(36).slice(2, 10);
  const m: Match = {
    id, config, players: [], state: "lobby", roundIndex: 0, current: null,
    timer: null, intermission: null,
  };
  matches.set(id, m);
  return m;
}

export function getMatch(id: string): Match | undefined {
  return matches.get(id);
}

export function addPlayer(m: Match, ws: any, name: string): Player {
  const p: Player = {
    id: Math.random().toString(36).slice(2, 8),
    name: name.slice(0, 20) || "Player",
    ready: false, hp: m.config.startingHp, ws,
    guess: null, guessAt: null, correctTime: null,
  };
  m.players.push(p);
  return p;
}

function send(p: Player, type: string, payload: any) {
  if (p.ws?.readyState === 1) p.ws.send(JSON.stringify({ type, payload }));
}

function broadcast(m: Match, type: string, payload: any) {
  m.players.forEach((p) => send(p, type, payload));
}

function lobbyState(m: Match) {
  return {
    players: m.players.map((p) => ({ id: p.id, name: p.name, ready: p.ready })),
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
      o: norm(c.o), h: norm(c.h), l: norm(c.l), c: norm(c.c),
      v: anonymizePrice ? c.v : c.v,
    };
  });
}

async function startRound(m: Match) {
  m.roundIndex++;
  if (m.roundIndex > m.config.rounds) return endMatch(m);
  m.state = "playing";
  m.players.forEach((p) => { p.guess = null; p.guessAt = null; p.correctTime = null; });
  try {
    const universe = await getUniverse(m.config.universe);
    const { ticker, candles } = await sampleWindow(universe, m.config.timeframe);
    m.current = { ticker, candles, startedAt: Date.now() };
    broadcast(m, "roundStart", {
      window: anonymize(candles, m),
      timeframe: m.config.timeframe,
      anonymize: { date: m.config.anonymizeDate, price: m.config.anonymizePrice },
      roundIndex: m.roundIndex,
      totalRounds: m.config.rounds,
      timeLimit: m.config.roundTimer,
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
  const damage: any = {};
  m.players.forEach((p) => {
    if (p.guess === correct && p.guessAt != null) {
      const secs = (p.guessAt - m.current!.startedAt) / 1000;
      p.correctTime = secs;
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
  const ko = m.players.find((p) => p.hp <= 0);
  broadcast(m, "roundEnd", {
    correctTicker: correct,
    guesses: m.players.map((p) => ({ id: p.id, guess: p.guess, guessAt: p.guessAt, correctTime: p.correctTime })),
    damage,
    hp: hpMap(m),
    winner: m.players.find((p) => damage[p.id] > 0)?.id || null,
  });
  if (ko) return endMatch(m);
  m.intermission = setTimeout(() => startRound(m), 5000);
}

function endMatch(m: Match) {
  m.state = "ended";
  if (m.timer) clearTimeout(m.timer);
  if (m.intermission) clearTimeout(m.intermission);
  const winner = determineWinner(m);
  broadcast(m, "matchEnd", {
    winner,
    finalHp: hpMap(m),
    roundsWon: {},
    totalTimeToCorrect: m.players.reduce((a, p) => ({ ...a, [p.id]: (p.correctTime ?? 0) }), {}),
  });
}

function determineWinner(m: Match): string | null {
  const alive = m.players.filter((p) => p.hp > 0);
  if (alive.length === 1) return alive[0].id;
  if (m.players.length < 2) return m.players[0]?.id ?? null;
  const [a, b] = m.players;
  if (a.hp !== b.hp) return a.hp > b.hp ? a.id : b.id;
  const ta = a.correctTime ?? Infinity, tb = b.correctTime ?? Infinity;
  return ta < tb ? a.id : tb < ta ? b.id : null;
}

export async function handleMessage(m: Match, p: Player, msg: any) {
  if (msg.type === "ready") {
    if (m.state !== "lobby") return;
    p.ready = !!msg.ready;
    console.log(`[match:${m.id}] ${p.name} ready=${p.ready} players=${m.players.length} allReady=${m.players.every((x) => x.ready)}`);
    broadcast(m, "readyState", lobbyState(m).players);
    if (m.players.length === 2 && m.players.every((x) => x.ready)) {
      m.state = "playing";
      broadcast(m, "matchStart", { config: m.config });
      m.roundIndex = 0;
      console.log(`[match:${m.id}] matchStart -> starting round 1`);
      await startRound(m);
    }
  } else if (msg.type === "guess") {
    if (m.state !== "playing") return;
    if (p.guess != null) return;
    p.guess = (msg.ticker || "").toUpperCase();
    p.guessAt = Date.now();
    send(p, "guessAck", { guess: p.guess });
    broadcast(m, "guessSubmitted", { playerId: p.id, name: p.name, guess: p.guess, guessAt: p.guessAt });
    const correct = m.current?.ticker;
    const bothSubmitted = m.players.every((x) => x.guess != null);
    const someoneCorrect = m.players.some((x) => x.guess === correct);
    if (someoneCorrect || bothSubmitted) endRound(m);
  }
}

export function removePlayer(m: Match, p: Player) {
  m.players = m.players.filter((x) => x.id !== p.id);
  if (m.timer) clearTimeout(m.timer);
  if (m.intermission) clearTimeout(m.intermission);
  m.players.forEach((o) => send(o, "opponentDisconnected", { graceUntil: Date.now() + 30000 }));
  if (m.players.length === 0) matches.delete(m.id);
}
