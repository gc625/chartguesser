"use client";
import { useEffect, useRef, useState, useCallback } from "react";

export type PlayerInfo = { id: string; name: string; ready: boolean };
export type MatchConfig = {
  universe: string; rounds: number; roundTimer: number; startingHp: number;
  anonymizeDate: boolean; anonymizePrice: boolean; timeframe: string;
};
export type WindowCandle = { i: number; o: number; h: number; l: number; c: number; v: number };

export type MatchState = {
  connected: boolean;
  joined: boolean;
  playerId: string | null;
  players: PlayerInfo[];
  config: MatchConfig | null;
  phase: "lobby" | "playing" | "roundEnd" | "ended";
  round: { index: number; total: number; timeLimit: number; window: WindowCandle[]; timeframe: string; anonymize: any; hp: any } | null;
  roundResult: { correctTicker: string; guesses: any[]; damage: any; hp: any; winner: string | null } | null;
  matchResult: { winner: string | null; finalHp: any; totalTimeToCorrect: any } | null;
  myGuess: string | null;
  error: string | null;
};

export function useMatch(matchId: string, displayName: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<MatchState>({
    connected: false, joined: false, playerId: null, players: [], config: null,
    phase: "lobby", round: null, roundResult: null, matchResult: null, myGuess: null, error: null,
  });

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/${matchId}`);
    wsRef.current = ws;
    ws.onopen = () => {
      setState((s) => ({ ...s, connected: true }));
      ws.send(JSON.stringify({ type: "join", displayName }));
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      const { type, payload } = msg;
      setState((s) => {
        switch (type) {
          case "joined": return { ...s, joined: true, playerId: payload.playerId };
          case "playerJoined": return { ...s, players: payload.players, config: payload.config || s.config };
          case "readyState": return { ...s, players: payload };
          case "matchStart": return { ...s, phase: "playing", config: payload.config, roundResult: null, matchResult: null };
          case "roundStart": return { ...s, phase: "playing", round: { index: payload.roundIndex, total: payload.totalRounds, timeLimit: payload.timeLimit, window: payload.window, timeframe: payload.timeframe, anonymize: payload.anonymize, hp: payload.hp }, roundResult: null, myGuess: null };
          case "guessAck": return { ...s, myGuess: payload.guess };
          case "roundEnd": return { ...s, phase: "roundEnd", roundResult: { correctTicker: payload.correctTicker, guesses: payload.guesses, damage: payload.damage, hp: payload.hp, winner: payload.winner } };
          case "matchEnd": return { ...s, phase: "ended", matchResult: { winner: payload.winner, finalHp: payload.finalHp, totalTimeToCorrect: payload.totalTimeToCorrect } };
          case "opponentDisconnected": return { ...s, error: "Opponent disconnected" };
          case "error": return { ...s, error: payload.message };
          default: return s;
        }
      });
    };
    ws.onclose = () => setState((s) => ({ ...s, connected: false }));
    return () => ws.close();
  }, [matchId, displayName]);

  const send = useCallback((msg: any) => wsRef.current?.send(JSON.stringify(msg)), []);
  const setReady = useCallback((ready: boolean) => send({ type: "ready", ready }), [send]);
  const submitGuess = useCallback((ticker: string) => send({ type: "guess", ticker }), [send]);

  return { state, setReady, submitGuess };
}
