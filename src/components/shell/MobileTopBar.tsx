"use client";

import { ArrowLeft, BedSingle, Building2, House, LayoutGrid, Trees } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { MobileSearch } from "@/features/search/components/MobileSearch";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

// Explore pages: home (and its login/signup backdrops) and the results page.
const EXPLORE_PATHS = new Set(["/", "/search", "/login", "/signup", "/forgot-password"]);

const CATEGORIES = [
  { key: "catAll", type: null, icon: LayoutGrid, tint: "text-amber-500" },
  { key: "catApartments", type: "APARTMENT", icon: Building2, tint: "text-sky-600" },
  { key: "catHouses", type: "PRIVATE_HOUSE", icon: House, tint: "text-rose-500" },
  { key: "catLodges", type: "LODGE", icon: Trees, tint: "text-emerald-600" },
  { key: "catRooms", type: "ROOM", icon: BedSingle, tint: "text-violet-600" },
] as const;

/** Height of the home bar (search pill + category chips); the results bar is 80px. */
export const MOBILE_TOP_BAR_PX = 80;

/** Category chips under the search pill, like the app's All / Homes / Experiences row. */
function Categories() {
  const t = useTranslations("Home");
  const params = useSearchParams();
  const pathname = usePathname();
  const current = pathname === "/search" ? params.get("type") : null;
  return (
    <nav aria-label={t("categories")} className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {CATEGORIES.map(({ key, type, icon: Icon, tint }) => {
        const active = type === current || (type === null && pathname === "/");
        return (
          <Link
            key={key}
            href={type ? { pathname: "/search", query: { mode: "short", type } } : "/"}
            aria-current={active ? "page" : undefined}
            className={cn(
              // Same border as the website's filter buttons.
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
              active ? "border-primary bg-primary/[0.06] text-primary" : "border-line bg-surface text-ink active:border-ink/30 max-md:active:border-primary",
            )}
          >
            <Icon className={cn("size-4", active ? "text-primary" : tint)} strokeWidth={2} aria-hidden="true" />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}

/** Phones only: sticky search on the explore pages (pill + categories on home; back + pill on results). */
export function MobileTopBar() {
  const pathname = usePathname();
  const t = useTranslations("Nav");
  if (!EXPLORE_PATHS.has(pathname)) return null;
  if (pathname === "/search") {
    return (
      <div className="sticky top-0 z-40 flex h-[72px] items-center gap-3 bg-canvas/90 px-4 backdrop-blur-md md:hidden">
        <Link href="/" aria-label={t("back")} className="flex size-11 shrink-0 items-center justify-center rounded-full transition-colors active:bg-ink/10">
          <ArrowLeft className="size-5 text-ink" aria-hidden="true" />
        </Link>
        <MobileSearch results className="flex-1" />
        <span className="size-11 shrink-0" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className="sticky top-0 z-40 bg-gradient-to-b from-[#ececec] to-canvas/95 px-4 pt-3 backdrop-blur-md md:hidden">
      <MobileSearch className="mb-3" />
      <Suspense>
        <Categories />
      </Suspense>
    </div>
  );
}
