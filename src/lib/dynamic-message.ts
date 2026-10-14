/**
 * Translates a key built from stored data (e.g. an audit action), falling back to the raw value when the key is
 * unknown, so a new action never breaks a page.
 */
export function dynamicMessage(
  t: { has: (key: never) => boolean } & ((key: never, values?: never) => string),
  key: string,
  fallback: string,
  values?: Record<string, string | number>,
): string {
  return t.has(key as never) ? t(key as never, values as never) : fallback;
}
