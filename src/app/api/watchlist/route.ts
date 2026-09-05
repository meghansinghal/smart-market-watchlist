import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/apiError";
import { addWatchlistItemSchema } from "@/server/validation/schemas";
import { watchlistService } from "@/server/services/watchlistService";

export async function GET() {
  try {
    const items = await watchlistService.list();
    return NextResponse.json({ items });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = addWatchlistItemSchema.parse(await request.json());
    const item = await watchlistService.add(body.symbol);
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
