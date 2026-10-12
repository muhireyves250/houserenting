export function formatRWF(amount: number, locale: string = "en"): string {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`RWF amounts must be whole numbers, got ${amount}`);
  }
  return `RWF ${new Intl.NumberFormat(locale).format(amount)}`;
}
