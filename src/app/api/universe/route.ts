import { NextRequest, NextResponse } from "next/server";
import { AI_BOTTLENECK_CATEGORIES, getUniverse, UNIVERSE_NAMES } from "@/lib/universes";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ universes: UNIVERSE_NAMES });
  const tickers = await getUniverse(name);
  return NextResponse.json({
    name,
    tickers,
    categories: name === "AI Bottlenecks" ? AI_BOTTLENECK_CATEGORIES : undefined,
  });
}
