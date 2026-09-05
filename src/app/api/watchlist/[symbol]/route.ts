import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/apiError";
import { watchlistService } from "@/server/services/watchlistService";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  try {
    const { symbol } = await params;
    await watchlistService.remove(decodeURIComponent(symbol));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
