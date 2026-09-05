import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/apiError";
import { requireUserId } from "@/lib/demoUser";
import { explain } from "@/server/services/explanationGenerator";
import { marketBriefService } from "@/server/services/marketBriefService";
import { marketDataService } from "@/server/services/marketDataService";
import { benchmarkFor } from "@/server/domain/sectors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  try {
    const userId = await requireUserId(request.nextUrl.searchParams.get("userId"));
    const { symbol: rawSymbol } = await params;
    const symbol = decodeURIComponent(rawSymbol);
    const brief = await marketBriefService.getSymbolBrief(userId, symbol);
    // Without a current observation, historical bars have nothing to
    // anchor against and nothing to say about "now" — showing a chart
    // next to an "unavailable" message would just contradict it. This
    // also skips a pointless provider call for a symbol we already know
    // has no valid data.
    const historicalBars = brief.observation ? await marketDataService.fetchHistorical(symbol, 20) : [];

    return NextResponse.json({
      ...brief,
      explanation: brief.change ? explain(brief.change) : null,
      benchmarkSymbol: benchmarkFor(symbol),
      historicalBars,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
