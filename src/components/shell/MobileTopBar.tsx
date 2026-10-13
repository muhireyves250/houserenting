"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { MobileSearch } from "@/features/search/components/MobileSearch";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";

// Explore pages: home (and its login/signup backdrops) and the results page.
const EXPLORE_PATHS = new Set(["/", "/search", "/login", "/signup", "/forgot-password"]);

/** Height of this bar (12 + 56 + 12px); the results page's sticky filter bar and map sit below it. */
export const MOBILE_TOP_BAR_PX = 80;

/** Phones only: sticky "Start your search" pill with a language button, on the explore pages. */
export function MobileTopBar() {
  const pathname = usePathname();
  const t = useTranslations("Nav");
  if (!EXPLORE_PATHS.has(pathname)) return null;
  if (pathname === "/search") {
    // Results: back to explore, and the current search as a centred pill.
    return (
      <div className="sticky top-0 z-40 flex h-20 items-center gap-3 bg-canvas/90 px-4 backdrop-blur-md md:hidden">
        <Link href="/" aria-label={t("back")} className="flex size-11 shrink-0 items-center justify-center rounded-full transition-colors active:bg-ink/10">
          <ArrowLeft className="size-5 text-ink" aria-hidden="true" />
        </Link>
        <MobileSearch results className="flex-1" />
        <span className="size-11 shrink-0" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className="sticky top-0 z-40 flex h-20 items-center gap-2 bg-canvas/90 px-4 backdrop-blur-md md:hidden">
      <MobileSearch className="flex-1" />
      <Suspense>
        <LocaleSwitcher compact />
      </Suspense>
    </div>
  );
}
