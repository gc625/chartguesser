import { NextRequest, NextResponse } from "next/server";
import { createMatch, type MatchConfig } from "@/lib/match";
import { CUSTOM_UNIVERSE, UNIVERSE_NAMES } from "@/lib/universes";

const MAX_CUSTOM_TICKERS = 50;

function normalizeTickers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((ticker): ticker is string => typeof ticker === "string")
    .map((ticker) => ticker.trim().toUpperCase())
    .filter((ticker) => /^[A-Z0-9.-]{1,15}$/.test(ticker))
  )].slice(0, MAX_CUSTOM_TICKERS);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const universe = typeof body.universe === "string" && [...UNIVERSE_NAMES, CUSTOM_UNIVERSE].includes(body.universe)
    ? body.universe
    : "Dow 30";
  const customTickers = normalizeTickers(body.customTickers);
  if (universe === CUSTOM_UNIVERSE && customTickers.length < 2) {
    return NextResponse.json({ error: "Add at least two valid tickers to a custom basket." }, { status: 400 });
  }
  const guessMode = body.guessMode === "unlimited" ? "unlimited" : "single";
  const requestedPenalty = Number(body.wrongGuessPenalty);
  const wrongGuessPenalty = [1, 3, 5, 10].includes(requestedPenalty) ? requestedPenalty : 5;
  const config: MatchConfig = {
    universe,
    rounds: Number(body.rounds) || 5,
    roundTimer: Number(body.roundTimer) || 60,
    startingHp: Number(body.startingHp) || 100,
    customTickers: universe === CUSTOM_UNIVERSE ? customTickers : [],
    guessMode,
    wrongGuessPenalty,
    anonymizeDate: body.anonymizeDate === true,
    anonymizePrice: body.anonymizePrice === true,
    timeframe: "Daily",
  };
  const m = createMatch(config);
  return NextResponse.json({ id: m.id, config: m.config });
}
