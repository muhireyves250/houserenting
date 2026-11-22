import "server-only";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";

/** Emails a "confirm your email" link (e.g. to someone just added to a team, whose access starts once confirmed). */
export async function sendConfirmation(email: string, callbackPath: string): Promise<void> {
  try {
    await auth.api.sendVerificationEmail({ body: { email, callbackURL: callbackPath } });
  } catch (err) {
    logger.error({ err }, "confirmation email failed");
  }
}
