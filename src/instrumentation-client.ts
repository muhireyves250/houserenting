import * as Sentry from "@sentry/nextjs";
import { SENTRY_DATA_COLLECTION } from "@/lib/sentry-options";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, tracesSampleRate: 0.1, dataCollection: SENTRY_DATA_COLLECTION });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
