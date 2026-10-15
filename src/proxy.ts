import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { welcomeRedirect } from "@/features/onboarding/welcome-rule";
import { REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE, referralFromUrl } from "@/features/referrals/cookie";
import { routing } from "@/i18n/routing";

const intl = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  // Opened links and hard refreshes start on the welcome page, decided before any page is sent (no flash).
  const welcome = welcomeRedirect({ url: request.url, headers: request.headers });
  const response = welcome ? NextResponse.redirect(new URL(welcome, request.url)) : intl(request);
  // Invite links (?ref=R-XXXXXX): remember the code until the visitor signs up.
  const ref = referralFromUrl(request.url);
  if (ref) {
    response.cookies.set(REFERRAL_COOKIE, ref, { maxAge: REFERRAL_COOKIE_MAX_AGE, httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/" });
  }
  return response;
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
