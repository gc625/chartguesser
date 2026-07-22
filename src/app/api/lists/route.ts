import { NextRequest, NextResponse } from "next/server";
import {
  CommunityDatabaseUnavailableError,
  DuplicateCommunityListError,
  createCommunityList,
  listCommunityLists,
} from "@/lib/communityLists";

export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;
const publishCounts = new Map<string, { count: number; startedAt: number }>();

function isRateLimited(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "anonymous";
  const now = Date.now();
  const current = publishCounts.get(ip);
  if (!current || now - current.startedAt >= DAY_MS) {
    publishCounts.set(ip, { count: 1, startedAt: now });
    return false;
  }
  current.count++;
  return current.count > 5;
}

export async function GET() {
  try {
    return NextResponse.json({ lists: await listCommunityLists() });
  } catch (error) {
    if (error instanceof CommunityDatabaseUnavailableError) {
      return NextResponse.json({ error: "Community lists are temporarily unavailable." }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not load community lists." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 20_000) {
    return NextResponse.json({ error: "List payload is too large." }, { status: 413 });
  }
  if (isRateLimited(request)) {
    return NextResponse.json({ error: "Publishing limit reached. Try again tomorrow." }, { status: 429 });
  }
  try {
    const body = await request.json();
    if (body.website) return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
    const list = await createCommunityList(body);
    return NextResponse.json({ list }, { status: 201 });
  } catch (error) {
    if (error instanceof TypeError || error instanceof DuplicateCommunityListError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof CommunityDatabaseUnavailableError) {
      return NextResponse.json({ error: "Community publishing is temporarily unavailable." }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not publish this list." }, { status: 500 });
  }
}
