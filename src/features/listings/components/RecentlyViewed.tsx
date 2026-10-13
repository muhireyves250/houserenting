"use client";

import { House, Star } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { HomeRow } from "@/features/home/components/HomeRow";
import { readRecent, RECENT_EVENT, rememberView, type RecentListing } from "@/features/listings/recently-viewed";
import { PLACE_TYPES, type PlaceType } from "@/features/search/params";
import { Link } from "@/i18n/navigation";

function subscribe(onChange: () => void) {
  window.addEventListener(RECENT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(RECENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The stored list, as a stable string snapshot (parsed once per change). */
function useRecent(): RecentListing[] {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem("sr_recent") ?? "";
      } catch {
        return "";
      }
    },
    () => "",
  );
  // Re-read when the stored string changes.
  return useMemo(() => (raw ? readRecent() : []), [raw]);
}

/** Listing page: remembers this home on the device. */
export function TrackView({ listing }: { listing: RecentListing }) {
  useEffect(() => rememberView(listing), [listing]);
  return null;
}

function RecentCard({ item }: { item: RecentListing }) {
  const tType = useTranslations("ListingType");
  const t = useTranslations("Listings");
  // Stored data is untrusted: only translate known types.
  const type = (PLACE_TYPES as readonly string[]).includes(item.type) ? tType(item.type as PlaceType) : "";
  return (
    <Link href={`/listings/${item.id}`} className="group flex flex-col gap-2 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
      <span className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-primary-soft text-primary">
        {item.photo ? (
          <Image src={item.photo} alt="" fill sizes="(min-width: 768px) 20vw, 45vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.05]" />
        ) : (
          <House className="size-8" aria-hidden="true" />
        )}
      </span>
      <span className="px-0.5">
        <span className="block truncate text-sm font-semibold text-ink">{type ? t("typeIn", { type, city: item.city }) : item.city}</span>
        <span className="flex items-center gap-1 text-[13px] text-muted">
          {item.ratingCount > 0 ? (
            <>
              <Star className="size-3 fill-current" aria-hidden="true" />
              {item.ratingAvg.toFixed(2)}
            </>
          ) : (
            <span className="truncate">{item.title}</span>
          )}
        </span>
      </span>
    </Link>
  );
}

/** Row of homes opened on this device; renders nothing until there is at least one. */
export function RecentlyViewedRow() {
  const t = useTranslations("Listings");
  const recent = useRecent();
  if (recent.length === 0) return null;
  return (
    <HomeRow title={t("recentlyViewed")} subtitle={t("recentlyViewedSub")}>
      {recent.map((item) => (
        <RecentCard key={item.id} item={item} />
      ))}
    </HomeRow>
  );
}
