import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { PROMOTER_COOKIE, PROMOTER_COOKIE_MAX_AGE, safeTarget } from "@/features/promoters/cookie";
import { recordVisit } from "@/features/promoters/service";
import { todayISO } from "@/features/search/date-range";
import { getEnv } from "@/lib/env";

/**
 * A promoter's QR link: counts the visit (once a day per visitor, from a salted hash, never the raw address),
 * remembers the promoter for 30 days on the server's cookie, then opens the page it points to.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const target = safeTarget(request.nextUrl.searchParams.get("to"));
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const visitor = createHash("sha256")
    .update(`${getEnv().BETTER_AUTH_SECRET}|${ip}|${request.headers.get("user-agent") ?? ""}|${todayISO()}`)
    .digest("hex")
    .slice(0, 32);
  const active = await recordVisit(code, visitor).catch(() => false);
  const response = NextResponse.redirect(new URL(target, request.url));
  if (active) {
    response.cookies.set(PROMOTER_COOKIE, code, { maxAge: PROMOTER_COOKIE_MAX_AGE, httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/" });
  }
  return response;
}
