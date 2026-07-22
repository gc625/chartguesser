"use client";
import { useEffect, useRef, useState, useCallback } from "react";

export type PlayerInfo = { id: string; name: string; ready: boolean; connected?: boolean };
export type MatchConfig = {
  universeId: string; universe: string;
  universeSource: "built-in" | "etf" | "community" | "custom";
  tickers: string[];
  rounds: number; roundTimer: number; startingHp: number;
  customTickers: string[];
  guessMode: "single" | "unlimited"; wrongGuessPenalty: number;
  anonymizeDate: boolean; anonymizePrice: boolean; timeframe: string;
};
export type WindowCandle = { i: number; t: number; o: number; h: number; l: number; c: number; v: number };

export type Guess = { playerId: string; name: string; guess: string; guessAt: number };
export type MatchState = {
  connected: boolean;
  joined: boolean;
  playerId: string | null;
  players: PlayerInfo[];
  config: MatchConfig | null;
  phase: "lobby" | "playing" | "roundEnd" | "ended";
  round: { index: number; total: number; timeLimit: number; startedAt: number; endsAt: number; window: WindowCandle[]; timeframe: string; anonymize: any; hp: any } | null;
  roundResult: { correctTicker: string; guesses: any[]; damage: any; hp: any; winner: string | null; nextRoundAt: number | null } | null;
  matchResult: {
    winner: string | null;
    finalHp: Record<string, number>;
    roundsWon: Record<string, number>;
    totalTimeToCorrect: Record<string, number>;
    shareRounds: { correctPlayerIds: string[]; attemptedPlayerIds: string[] }[];
  } | null;
  myGuess: string | null;
  myGuessLocked: boolean;
  guesses: Guess[];
  guessActivity: Record<string, number>;
  rematchReady: Record<string, boolean>;
  error: string | null;
};

export function useMatch(matchId: string, displayName: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<MatchState>({
    connected: false, joined: false, playerId: null, players: [], config: null,
    phase: "lobby", round: null, roundResult: null, matchResult: null, myGuess: null, myGuessLocked: false,
    guesses: [], guessActivity: {}, rematchReady: {}, error: null,
  });

  useEffect(() => {
    let disposed = false;
    let shouldReconnect = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const storageKey = `chartguesser:session:${matchId}`;
    let sessionId = window.localStorage.getItem(storageKey);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      window.localStorage.setItem(storageKey, sessionId);
    }
    window.localStorage.setItem(`${storageKey}:name`, displayName);

    const connect = () => {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${window.location.host}/ws/${matchId}`);
      wsRef.current = ws;
      ws.onopen = () => {
        attempts = 0;
        setState((s) => ({ ...s, connected: true, error: null }));
        ws.send(JSON.stringify({ type: "join", displayName, sessionId }));
      };
      ws.onmessage = (ev) => {
        let msg: any;
        try { msg = JSON.parse(ev.data); } catch { return; }
        const { type, payload } = msg;
        if (type === "error" && [
          "Match not found", "Match is full", "Match has already started", "Invalid player session",
        ].includes(payload.message)) {
          shouldReconnect = false;
        }
        setState((s) => {
          switch (type) {
            case "joined": return { ...s, joined: true, playerId: payload.playerId };
            case "playerJoined": return { ...s, players: payload.players, config: payload.config || s.config };
            case "readyState": return { ...s, players: payload };
            case "playerDisconnected": return { ...s, players: s.players.map((p) => p.id === payload.playerId ? { ...p, connected: false } : p) };
            case "playerLeft": return { ...s, players: payload.players, config: payload.config || s.config };
            case "matchStart": return { ...s, phase: "playing", config: payload.config, roundResult: null, matchResult: null };
            case "roundStart": return {
              ...s, phase: "playing",
              round: { index: payload.roundIndex, total: payload.totalRounds, timeLimit: payload.timeLimit, startedAt: payload.startedAt, endsAt: payload.endsAt, window: payload.window, timeframe: payload.timeframe, anonymize: payload.anonymize, hp: payload.hp },
              roundResult: null, myGuess: null, myGuessLocked: false, guesses: [], guessActivity: {},
            };
            case "guessAck": return { ...s, myGuess: payload.guess, myGuessLocked: payload.locked };
            case "guessSubmitted": return s.guesses.some((g) => g.playerId === payload.playerId)
              ? s
              : { ...s, guesses: [...s.guesses, { playerId: payload.playerId, name: payload.name, guess: payload.guess, guessAt: payload.guessAt }] };
            case "guessActivity": return { ...s, guessActivity: { ...s.guessActivity, [payload.playerId]: payload.count } };
            case "hpUpdate": return {
              ...s,
              round: s.round ? { ...s.round, hp: payload.hp } : null,
            };
            case "roundEnd": return { ...s, phase: "roundEnd", roundResult: { correctTicker: payload.correctTicker, guesses: payload.guesses, damage: payload.damage, hp: payload.hp, winner: payload.winner, nextRoundAt: payload.nextRoundAt } };
            case "matchEnd": return {
              ...s,
              phase: "ended",
              matchResult: {
                winner: payload.winner,
                finalHp: payload.finalHp,
                roundsWon: payload.roundsWon,
                totalTimeToCorrect: payload.totalTimeToCorrect,
                shareRounds: payload.shareRounds || [],
              },
            };
            case "rematchState": return { ...s, rematchReady: Object.fromEntries(payload.players.map((p: { id: string; ready: boolean }) => [p.id, p.ready])) };
            case "rematchLobby": return {
              ...s, phase: "lobby", players: payload.players, config: payload.config,
              round: null, roundResult: null, matchResult: null, myGuess: null, myGuessLocked: false,
              guesses: [], guessActivity: {}, rematchReady: {},
            };
            case "error": return { ...s, error: payload.message };
            default: return s;
          }
        });
      };
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        setState((s) => ({ ...s, connected: false }));
        if (!disposed && shouldReconnect) {
          const delay = Math.min(1000 * 2 ** attempts++, 10000);
          reconnectTimer = setTimeout(connect, delay);
        }
      };
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [matchId, displayName]);

  const send = useCallback((msg: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);
  const setReady = useCallback((ready: boolean) => send({ type: "ready", ready }), [send]);
  const submitGuess = useCallback((ticker: string) => send({ type: "guess", ticker }), [send]);
  const setRematchReady = useCallback((ready: boolean) => send({ type: "rematch", ready }), [send]);

  return { state, setReady, submitGuess, setRematchReady };
}
