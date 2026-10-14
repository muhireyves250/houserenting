import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { welcomeRedirect } from "@/features/onboarding/welcome-rule";
import { routing } from "@/i18n/routing";

const intl = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  // Opened links and hard refreshes start on the welcome page, decided before any page is sent (no flash).
  const welcome = welcomeRedirect({ url: request.url, headers: request.headers });
  if (welcome) return NextResponse.redirect(new URL(welcome, request.url));
  return intl(request);
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
