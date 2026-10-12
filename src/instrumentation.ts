import * as Sentry from "@sentry/nextjs";
import { SENTRY_DATA_COLLECTION } from "@/lib/sentry-options";

export async function register() {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    dataCollection: SENTRY_DATA_COLLECTION,
  });
}

export const onRequestError = Sentry.captureRequestError;
