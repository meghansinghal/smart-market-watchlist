import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/apiError";
import { commitCheckpointsSchema } from "@/server/validation/schemas";
import { checkpointService } from "@/server/services/checkpointService";

export async function POST(request: NextRequest) {
  try {
    const body = commitCheckpointsSchema.parse(await request.json());
    const outcomes = await checkpointService.commit(body.items);
    return NextResponse.json({ outcomes });
  } catch (err) {
    return toErrorResponse(err);
  }
}
