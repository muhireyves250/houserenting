/** Sorted, de-duplicated ICU argument names in a message: simple `{x}` and `{x, plural|select, …}`. */
export function icuArguments(message: string): string[] {
  const names = [...message.matchAll(/\{\s*(\w+)\s*[,}]/g)].map((m) => m[1]);
  return [...new Set(names)].sort();
}
