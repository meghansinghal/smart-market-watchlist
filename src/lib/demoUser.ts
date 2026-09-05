import { userRepository } from "@/server/repositories/userRepository";
import { userIdSchema } from "@/server/validation/schemas";

/** Thrown when a request names a userId that isn't one of the seeded demo
 * users — a data-integrity check, not an authentication failure. */
export class UnknownUserError extends Error {}

/**
 * Resolves and validates the demo user a request is acting as (from a
 * query param or request body field, depending on the route). This is
 * NOT authentication — there's no credential, just an id naming which
 * seeded demo user's watchlist/checkpoints the request should read or
 * write. Rejecting an unknown id early means a typo'd/garbage userId
 * fails loudly with a 400 instead of silently scoping to nothing.
 */
export async function requireUserId(raw: string | null | undefined): Promise<string> {
  const userId = userIdSchema.parse(raw ?? undefined);
  const exists = await userRepository.exists(userId);
  if (!exists) throw new UnknownUserError(`Unknown user: ${userId}`);
  return userId;
}
