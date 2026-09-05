import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/apiError";
import { isMarketLikelyOpen } from "@/server/domain/tradingDays";
import { explain } from "@/server/services/explanationGenerator";
import { marketBriefService } from "@/server/services/marketBriefService";

export async function GET() {
  try {
    const brief = await marketBriefService.getDashboardBrief();
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
