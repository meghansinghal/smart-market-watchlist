import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/apiError";
import { requireUserId } from "@/lib/demoUser";
import { isMarketLikelyOpen } from "@/server/domain/tradingDays";
import { explain } from "@/server/services/explanationGenerator";
import { marketBriefService } from "@/server/services/marketBriefService";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request.nextUrl.searchParams.get("userId"));
    const brief = await marketBriefService.getDashboardBrief(userId);
    const items = brief.items.map((item) => ({
      ...item,
      explanation: item.change ? explain(item.change) : null,
    }));
    return NextResponse.json({
      generatedAt: brief.generatedAt,
      marketOpen: isMarketLikelyOpen(brief.generatedAt),
      items,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
