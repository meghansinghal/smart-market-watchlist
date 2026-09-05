import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/apiError";
import { demoService } from "@/server/services/demoService";

export async function GET() {
  try {
    const scenarios = await demoService.listScenarios();
    return NextResponse.json({ scenarios });
  } catch (err) {
    return toErrorResponse(err);
  }
}
