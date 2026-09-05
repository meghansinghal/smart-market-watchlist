import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/apiError";
import { requireUserId } from "@/lib/demoUser";
import { demoService } from "@/server/services/demoService";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request.nextUrl.searchParams.get("userId"));
    const scenarios = await demoService.listScenarios(userId);
    return NextResponse.json({ scenarios });
  } catch (err) {
    return toErrorResponse(err);
  }
}
