import { getTranslations } from "next-intl/server";
import { FilterTabs } from "@/features/admin/components/ui";
import { db } from "@/lib/db";

/** Every house someone owns or works at (not archived), for filtering their dashboard pages. */
export function myPlaces(userId: string) {
  return db.listing.findMany({ where: { OR: [{ hostId: userId }, { team: { some: { userId } } }], status: { not: "ARCHIVED" } }, orderBy: { title: "asc" }, select: { id: true, title: true } });
}

/** The chosen house, only when it is one of theirs. */
export const chosenPlace = (places: { id: string }[], place: string | undefined) => (place && places.some((p) => p.id === place) ? place : undefined);

/** "All places" then one tab per house (with how many items each has); shown only with more than one house. */
export async function PlaceFilter({ path, places, chosen, counts }: { path: string; places: { id: string; title: string }[]; chosen?: string; counts?: Record<string, number> & { all?: number } }) {
  if (places.length < 2) return null;
  const t = await getTranslations("Host");
  return (
    <FilterTabs
      items={[
        { label: t("allPlaces"), href: path, on: !chosen, count: counts?.all },
        ...places.map((p) => ({ label: p.title, href: { pathname: path, query: { place: p.id } }, on: chosen === p.id, count: counts?.[p.id] })),
      ]}
    />
  );
}
