import type { ZodError } from "zod";

/** First message per top-level field, e.g. { email: "emailInvalid" }. */
export function firstErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
