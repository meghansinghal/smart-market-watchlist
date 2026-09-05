import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/apiError";
import { explain } from "@/server/services/explanationGenerator";
import { marketBriefService } from "@/server/services/marketBriefService";
import { marketDataService } from "@/server/services/marketDataService";
import { benchmarkFor } from "@/server/domain/sectors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  try {
    const { symbol: rawSymbol } = await params;
    const symbol = decodeURIComponent(rawSymbol);
    const [brief, historicalBars] = await Promise.all([
      marketBriefService.getSymbolBrief(symbol),
      marketDataService.fetchHistorical(symbol, 20),
    ]);

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
