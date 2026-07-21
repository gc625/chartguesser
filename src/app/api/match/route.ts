import { NextRequest, NextResponse } from "next/server";
import { createMatch, type MatchConfig } from "@/lib/match";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const config: MatchConfig = {
    universe: body.universe || "Dow 30",
    rounds: Number(body.rounds) || 5,
    roundTimer: Number(body.roundTimer) || 60,
    startingHp: Number(body.startingHp) || 100,
    anonymizeDate: body.anonymizeDate !== false,
    anonymizePrice: body.anonymizePrice === true,
    timeframe: body.timeframe || "Daily",
  };
  const m = createMatch(config);
  return NextResponse.json({ id: m.id, config: m.config });
}
