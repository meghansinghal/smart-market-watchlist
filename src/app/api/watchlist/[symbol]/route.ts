import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/apiError";
import { requireUserId } from "@/lib/demoUser";
import { watchlistService } from "@/server/services/watchlistService";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  try {
    const userId = await requireUserId(request.nextUrl.searchParams.get("userId"));
    const { symbol } = await params;
    await watchlistService.remove(userId, decodeURIComponent(symbol));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
