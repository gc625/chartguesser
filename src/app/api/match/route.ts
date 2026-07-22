import { NextRequest, NextResponse } from "next/server";
import { createMatch, type MatchConfig } from "@/lib/match";
import {
  CUSTOM_UNIVERSE,
  normalizeTickers,
  resolveBuiltInUniverse,
  type UniverseSnapshot,
} from "@/lib/universes";
import { resolveEtf } from "@/lib/etf";
import { resolveCommunityUniverse } from "@/lib/communityLists";

const MAX_CUSTOM_TICKERS = 200;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const requestedUniverse = typeof body.universe === "string" ? body.universe : "Dow 30";
  const customTickers = normalizeTickers(body.customTickers, MAX_CUSTOM_TICKERS);
  let snapshot: UniverseSnapshot | null = null;
  try {
    if (body.universeSource === "community" && typeof body.universeId === "string") {
      snapshot = await resolveCommunityUniverse(body.universeId);
    } else if (body.universeSource === "etf" && typeof body.universeId === "string") {
      const etf = await resolveEtf(body.universeId);
      snapshot = {
        id: etf.symbol,
        name: `${etf.symbol} constituents`,
        source: "etf",
        tickers: etf.tickers,
        issuer: etf.issuer,
        asOf: etf.asOf,
      };
    } else if (requestedUniverse === CUSTOM_UNIVERSE) {
      snapshot = {
        id: "custom",
        name: typeof body.universeName === "string" ? body.universeName.trim().slice(0, 60) || CUSTOM_UNIVERSE : CUSTOM_UNIVERSE,
        source: "custom",
        tickers: customTickers,
      };
    } else {
      snapshot = await resolveBuiltInUniverse(
        typeof body.universeId === "string" ? body.universeId : requestedUniverse,
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not resolve that ticker universe." },
      { status: 422 },
    );
  }
  if (!snapshot) {
    return NextResponse.json({ error: "Unknown ticker universe." }, { status: 400 });
  }
  if (snapshot.tickers.length < 2) {
    return NextResponse.json({ error: "Add at least two valid tickers to a custom basket." }, { status: 400 });
  }
  const guessMode = body.guessMode === "unlimited" ? "unlimited" : "single";
  const requestedPenalty = Number(body.wrongGuessPenalty);
  const wrongGuessPenalty = [1, 3, 5, 10].includes(requestedPenalty) ? requestedPenalty : 5;
  const config: MatchConfig = {
    universeId: snapshot.id,
    universe: snapshot.name,
    universeSource: snapshot.source,
    tickers: snapshot.tickers,
    rounds: Number(body.rounds) || 5,
    roundTimer: Number(body.roundTimer) || 60,
    startingHp: Number(body.startingHp) || 100,
    customTickers: snapshot.tickers,
    guessMode,
    wrongGuessPenalty,
    anonymizeDate: body.anonymizeDate === true,
    anonymizePrice: body.anonymizePrice === true,
    timeframe: "Daily",
  };
  const m = createMatch(config);
  return NextResponse.json({ id: m.id, config: m.config });
}
