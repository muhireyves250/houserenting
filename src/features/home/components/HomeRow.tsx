"use client";

import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Children, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { slideScrollLeft } from "@/lib/animate-scroll";
import { cn } from "@/lib/cn";

const ARROW =
  "flex size-9 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.08)] transition-[transform,border-color,color,box-shadow,opacity] duration-200 hover:scale-105 hover:border-primary hover:text-primary hover:shadow-[0_6px_14px_-6px_rgba(0,87,184,0.45)] active:scale-95 disabled:pointer-events-none disabled:opacity-30";

const EASE_OUT = "ease-[cubic-bezier(0.22,1,0.36,1)]";
// Cards slide in one after another; capped so long rows don't drag.
const STAGGER_MS = 70;
const MAX_STAGGER_MS = 420;

/**
 * "idle": rendered as-is (no JS yet, or the row was already on screen).
 * "hidden" → "shown": the row starts below the fold and slides its cards in when scrolled to.
 */
type Reveal = "idle" | "hidden" | "shown";

/** One home-page row: title linking to the matching search, and a swipeable track of cards with prev/next arrows. */
export function HomeRow({
  icon,
  title,
  subtitle,
  query,
  children,
}: {
  /** Decorative icon for the row's theme (city, mountains, lake…). */
  icon: ReactNode;
  title: string;
  subtitle: string;
  query: Record<string, string>;
  children: ReactNode;
}) {
  const t = useTranslations("Listings");
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  // Arrows stay hidden until measured, so rows that fit never flash them.
  const [edges, setEdges] = useState({ start: true, end: true });
  const [reveal, setReveal] = useState<Reveal>("idle");

  const update = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    // 1px slack absorbs sub-pixel scroll positions.
    setEdges({ start: track.scrollLeft <= 1, end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 1 });
  }, []);

  useEffect(() => {
    update();
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    if (trackRef.current) resize?.observe(trackRef.current);
    return () => resize?.disconnect();
  }, [update]);

  // Before first paint: rows below the fold hide, then slide in when they come into view.
  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (section.getBoundingClientRect().top < window.innerHeight) return;
    setReveal("hidden");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setReveal("shown");
        observer.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const page = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (track) slideScrollLeft(track, direction * track.clientWidth);
  };

  const animated = reveal !== "idle";
  const hidden = reveal === "hidden";

  return (
    <section ref={sectionRef} className="flex flex-col gap-4">
      <div
        className={cn(
          "flex items-center justify-between gap-4",
          animated && `transition-[opacity,transform] duration-700 ${EASE_OUT}`,
          hidden && "translate-y-3 opacity-0",
        )}
      >
        <div className="flex min-w-0 items-center gap-3 md:gap-4">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/[0.12] to-primary/[0.04] text-primary ring-1 ring-primary/10 md:size-12 md:rounded-2xl [&_svg]:size-5 md:[&_svg]:size-6"
            aria-hidden="true"
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg leading-6 font-bold tracking-[-0.02em] text-ink md:text-[22px] md:leading-7">{title}</h2>
            <p className="line-clamp-2 text-[13px] text-muted md:truncate md:text-sm">{subtitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href={{ pathname: "/search", query }}
            aria-label={t("seeRow", { title })}
            className="group/all inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1.5 pr-2.5 pl-3.5 text-[13px] font-semibold text-ink shadow-[0_1px_2px_rgba(16,24,40,0.06)] transition-[border-color,background-color,color,box-shadow] duration-300 hover:border-primary hover:bg-primary hover:text-white hover:shadow-[0_8px_18px_-8px_rgba(0,87,184,0.6)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t("seeAll")}
            <ArrowRight className="size-3.5 transition-transform duration-300 group-hover/all:translate-x-0.5" aria-hidden="true" />
          </Link>
          {/* No arrows when every card already fits. */}
          <div className={cn("hidden gap-2", !(edges.start && edges.end) && "md:flex")}>
            <button type="button" aria-label={t("previous")} disabled={edges.start} onClick={() => page(-1)} className={ARROW}>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label={t("next")} disabled={edges.end} onClick={() => page(1)} className={ARROW}>
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      <ul
        ref={trackRef}
        onScroll={update}
        className={cn(
          "-mx-4 -mb-4 grid snap-x snap-mandatory scroll-px-4 auto-cols-[62%] grid-flow-col gap-4 overflow-x-auto px-4 pt-2 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "sm:auto-cols-[40%] md:-mx-2 md:scroll-px-2 md:px-2 md:auto-cols-[calc((100%-3*16px)/4)] lg:auto-cols-[calc((100%-3*16px)/4)] xl:auto-cols-[calc((100%-4*16px)/5)]",
        )}
      >
        {Children.map(children, (child, index) => (
          <li
            className={cn(
              "snap-start",
              animated && `transition-[opacity,transform] duration-700 ${EASE_OUT}`,
              hidden && "translate-x-12 opacity-0",
            )}
            style={animated ? { transitionDelay: `${Math.min(index * STAGGER_MS, MAX_STAGGER_MS)}ms` } : undefined}
          >
            {child}
          </li>
        ))}
      </ul>
    </section>
  );
}
