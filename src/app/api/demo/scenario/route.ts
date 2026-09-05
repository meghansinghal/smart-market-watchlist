import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/apiError";
import { setDemoScenarioSchema } from "@/server/validation/schemas";
import { demoService } from "@/server/services/demoService";

export async function POST(request: NextRequest) {
  try {
    const body = setDemoScenarioSchema.parse(await request.json());
    await demoService.setScenario(body.symbol, body.scenario);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
