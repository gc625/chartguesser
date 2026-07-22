import { NextResponse } from "next/server";
import { CommunityDatabaseUnavailableError, getCommunityList } from "@/lib/communityLists";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const list = await getCommunityList(id);
    if (!list) return NextResponse.json({ error: "Community list not found." }, { status: 404 });
    return NextResponse.json({ list });
  } catch (error) {
    if (error instanceof CommunityDatabaseUnavailableError) {
      return NextResponse.json({ error: "Community lists are temporarily unavailable." }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not load this list." }, { status: 500 });
  }
}
