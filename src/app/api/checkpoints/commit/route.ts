import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/apiError";
import { requireUserId } from "@/lib/demoUser";
import { commitCheckpointsSchema } from "@/server/validation/schemas";
import { checkpointService } from "@/server/services/checkpointService";

export async function POST(request: NextRequest) {
  try {
    const body = commitCheckpointsSchema.parse(await request.json());
    const userId = await requireUserId(body.userId);
    const outcomes = await checkpointService.commit(userId, body.items);
    return NextResponse.json({ outcomes });
  } catch (err) {
    return toErrorResponse(err);
  }
}
