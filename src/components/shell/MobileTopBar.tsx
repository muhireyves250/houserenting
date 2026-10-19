"use client";

import { ArrowLeft, BedSingle, Building2, House, LayoutGrid, Trees } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { setResultsPending } from "@/features/search/results-pending";
import { Logo } from "@/components/ui/Logo";
import { MobileSearch } from "@/features/search/components/MobileSearch";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { useScrollDirection } from "@/lib/use-scroll-direction";

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
  // Chips filter the home page in place (?type=…); "All" clears it.
  const current = params.get("type");
  const activeIndex = CATEGORIES.findIndex(({ type }) => type === current || (type === null && !current && pathname === "/"));
  const navRef = useRef<HTMLElement>(null);
  const router = useRouter();
  // Filter in a transition so the home rows can show a skeleton until the new ones arrive.
  const [loading, startLoading] = useTransition();
  useEffect(() => setResultsPending(loading), [loading]);
  // The one indicator: a pill under the active chip that slides to whichever chip is tapped
  // (it moves on press, so the motion starts before the filtered rows load).
  // A press counts until the URL catches up (the active chip changes), then the active chip drives the pill.
  const [pressed, setPressed] = useState<{ index: number; from: number } | null>(null);
  const target = pressed && pressed.from === activeIndex ? pressed.index : activeIndex;
  const [pill, setPill] = useState<{ left: number; width: number; ready: boolean } | null>(null);
  useLayoutEffect(() => {
    const chip = navRef.current?.querySelectorAll<HTMLElement>("[data-chip]")[target];
    if (!chip) return setPill(null);
    setPill((prev) => ({ left: chip.offsetLeft, width: chip.offsetWidth, ready: prev !== null }));
  }, [target]);

  return (
    <nav
      ref={navRef}
      aria-label={t("categories")}
      className="relative -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {pill && (
        <span
          data-testid="category-pill"
          aria-hidden="true"
          style={{ width: `${pill.width}px`, transform: `translateX(${pill.left}px)` }}
          className={cn(
            "pointer-events-none absolute top-0 left-0 h-[calc(100%-0.75rem)] rounded-full border border-primary bg-primary/[0.08]",
            // First placement snaps; later moves slide with the site's easing.
            pill.ready && "transition-[transform,width] duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] motion-reduce:transition-none",
          )}
        />
      )}
      {CATEGORIES.map(({ key, type, icon: Icon, tint }, index) => {
        const active = index === target;
        return (
          <Link
            key={key}
            href={type ? { pathname: "/", query: { type } } : "/"}
            replace
            scroll={false}
            data-chip
            onPointerDown={() => setPressed({ index, from: activeIndex })}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
              event.preventDefault();
              setPressed({ index, from: activeIndex });
              startLoading(() => router.replace(type ? { pathname: "/", query: { type } } : "/", { scroll: false }));
            }}
            aria-current={index === activeIndex ? "page" : undefined}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold",
              "transition-[border-color,color,transform] duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] active:scale-95",
              active ? "border-transparent text-primary" : "border-line text-ink",
            )}
          >
            <Icon className={cn("size-4 transition-colors duration-500", active ? "text-primary" : tint)} strokeWidth={2} aria-hidden="true" />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}

// Pages with their own full-bleed top (listing photos) get no header.
const NO_HEADER_PREFIXES = ["/listings/", "/restaurants/", "/chats/"];

/** Logo (icon only), the search pill, and the language (flag) button, on one row. */
function HeaderRow() {
  return (
    <div className="flex items-center gap-2.5">
      {/* Plain logo, as tall as the 48px search pill. */}
      <Link
        href="/"
        className="flex h-12 shrink-0 items-center rounded-lg text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Logo className="[&_svg]:h-11 [&_svg]:w-[50px]" />
      </Link>
      <MobileSearch className="min-w-0 flex-1" />
      <Suspense>
        <LocaleSwitcher compact />
      </Suspense>
    </div>
  );
}

/** Phones only: sticky search on the explore pages (pill + categories on home; back + pill on results). */
export function MobileTopBar() {
  const pathname = usePathname();
  const t = useTranslations("Nav");
  const { hidden, scrolled } = useScrollDirection();
  if (NO_HEADER_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;
  if (!EXPLORE_PATHS.has(pathname)) {
    // Other pages (Favorites, Bookings, Chats, Profile): a slim header with the logo and language.
    return (
      <div data-print-hide
        className={cn(
          "sticky top-0 z-40 bg-canvas/90 px-4 py-2.5 backdrop-blur-md transition-shadow duration-500 md:hidden",
          scrolled && "shadow-[0_8px_20px_-14px_rgba(0,30,80,0.35)]",
        )}
      >
        <HeaderRow />
      </div>
    );
  }
  if (pathname === "/search") {
    return (
      <div data-print-hide className="sticky top-0 z-40 flex h-[72px] items-center gap-3 bg-canvas/90 px-4 backdrop-blur-md md:hidden">
        <Link href="/" aria-label={t("back")} className="flex size-11 shrink-0 items-center justify-center rounded-full transition-colors active:bg-ink/10">
          <ArrowLeft className="size-5 text-ink" aria-hidden="true" />
        </Link>
        <MobileSearch results className="flex-1" />
        <span className="size-11 shrink-0" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div data-print-hide
      className={cn(
        "sticky top-0 z-40 bg-gradient-to-b from-[#ececec] to-canvas/95 px-4 pt-3 backdrop-blur-md transition-shadow duration-500 md:hidden",
        scrolled && "shadow-[0_8px_20px_-14px_rgba(0,30,80,0.35)]",
      )}
    >
      <HeaderRow />
      <div className="h-3" aria-hidden="true" />
      {/* Tucked away while scrolling down (more room for homes), back on the way up. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          hidden ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
        )}
        inert={hidden}
      >
        <div className="min-h-0 overflow-hidden">
          <Suspense>
            <Categories />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
