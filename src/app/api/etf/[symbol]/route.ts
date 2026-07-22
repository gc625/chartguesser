import { NextResponse } from "next/server";
import { resolveEtf, UnsupportedEtfError } from "@/lib/etf";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  try {
    const result = await resolveEtf(symbol);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UnsupportedEtfError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: "ETF holdings are temporarily unavailable. Try again shortly." },
      { status: 502 },
    );
  }
}
