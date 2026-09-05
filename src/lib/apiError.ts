import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { InvalidSymbolError } from "@/server/services/watchlistService";

/** Central error → HTTP response mapping so route handlers never silently
 * swallow a failure — every thrown error becomes a visible, structured
 * JSON response instead of an opaque 500 or a hung request. */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "validation_failed", details: err.issues },
      { status: 400 },
    );
  }
  if (err instanceof InvalidSymbolError) {
    return NextResponse.json({ error: "invalid_symbol", message: err.message }, { status: 400 });
  }
  const message = err instanceof Error ? err.message : "Unexpected server error";
  console.error(err);
  return NextResponse.json({ error: "internal_error", message }, { status: 500 });
}
