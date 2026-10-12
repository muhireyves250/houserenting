import type { DataCollection } from "@sentry/core";

// Sentry 11 collects cookies, bodies and query strings by default. Auth requests carry
// passwords (bodies), sessions (cookies) and reset tokens (query), so all of that stays off.
export const SENTRY_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { allow: ["user-agent", "accept-language"] }, response: false },
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
} satisfies DataCollection;
