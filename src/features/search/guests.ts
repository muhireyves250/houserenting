export type GuestKey = "adults" | "children" | "pets";
export type GuestCounts = Record<GuestKey, number>;

export const MAX_PEOPLE = 16;
export const MAX_PETS = 5;

export function totalGuests(counts: GuestCounts): number {
  return counts.adults + counts.children;
}

export function stepGuests(counts: GuestCounts, key: GuestKey, delta: number): GuestCounts {
  const next = { ...counts, [key]: Math.max(0, counts[key] + delta) };
  if (totalGuests(next) > MAX_PEOPLE || next.pets > MAX_PETS) return counts;
  // Children and pets travel with an adult.
  if (next.children + next.pets > 0 && next.adults === 0) {
    if (key === "adults") return counts;
    next.adults = 1;
    if (totalGuests(next) > MAX_PEOPLE) return counts;
  }
  return next;
}

export function canStep(counts: GuestCounts, key: GuestKey, delta: number): boolean {
  const next = stepGuests(counts, key, delta);
  return next.adults !== counts.adults || next.children !== counts.children || next.pets !== counts.pets;
}
