import { NextRequest, NextResponse } from "next/server";
import { getMatch } from "@/lib/match";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const m = getMatch(id);
  if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    id: m.id,
    config: m.config,
    players: m.players.map((p) => ({ name: p.name, ready: p.ready })),
    state: m.state,
  });
}
