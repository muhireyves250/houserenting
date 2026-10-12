"use client";

import { useLocale, useTranslations } from "next-intl";
import { totalGuests } from "./guests";
import type { SearchState } from "./search-store";

/** Short human summaries of the chosen dates and guests, or null when nothing is chosen. */
export function useSearchSummaries({ range, flex, guests }: SearchState): { whenSummary: string | null; whoSummary: string | null } {
  const t = useTranslations("Home");
  const locale = useLocale();
  const shortDate = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" });
  const fmt = (iso: string) => shortDate.format(new Date(`${iso}T00:00:00Z`));

  const whenSummary = range.checkIn
    ? [fmt(range.checkIn), range.checkOut && fmt(range.checkOut)].filter(Boolean).join(" – ") + (flex ? ` (${t("flexDays", { days: flex })})` : "")
    : null;
  const people = totalGuests(guests);
  const whoSummary = people
    ? [t("guestsSummary", { count: people }), guests.pets ? t("petsSummary", { count: guests.pets }) : null].filter(Boolean).join(", ")
    : null;
  return { whenSummary, whoSummary };
}
