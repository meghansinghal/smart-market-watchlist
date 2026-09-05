import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/apiError";
import { requireUserId } from "@/lib/demoUser";
import { addWatchlistItemSchema } from "@/server/validation/schemas";
import { watchlistService } from "@/server/services/watchlistService";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request.nextUrl.searchParams.get("userId"));
    const items = await watchlistService.list(userId);
    return NextResponse.json({ items });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = addWatchlistItemSchema.parse(await request.json());
    const userId = await requireUserId(body.userId);
    const item = await watchlistService.add(userId, body.symbol);
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
