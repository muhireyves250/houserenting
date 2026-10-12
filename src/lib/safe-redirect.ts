/** Accept only same-site absolute paths ("/x"); anything else returns the fallback. */
export function safeNextPath(input: unknown, fallback = "/"): string {
  if (typeof input !== "string") return fallback;
  if (!input.startsWith("/") || input.startsWith("//") || input.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(input)) return fallback;
  return input;
}
