import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/apiError";
import { userRepository } from "@/server/repositories/userRepository";

/** Lists the seeded demo users for the User Switcher. Not an auth
 * endpoint — there's nothing secret here, just the small fixed set of
 * demo identities this app supports. */
export async function GET() {
  try {
    const users = await userRepository.list();
    return NextResponse.json({ users });
  } catch (err) {
    return toErrorResponse(err);
  }
}
