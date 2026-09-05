import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/apiError";
import { demoService } from "@/server/services/demoService";

export async function POST() {
  try {
    await demoService.reset();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
