import { useId } from "react";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

/** Round flag for a UI language (drawn as SVG: emoji flags render inconsistently across phones). */
export function Flag({ locale, className }: { locale: AppLocale; className?: string }) {
  const clip = useId();
  return (
    <span className={cn("inline-flex size-6 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10", className)} aria-hidden="true">
      {locale === "rw" && (
        <svg viewBox="0 0 60 40" preserveAspectRatio="xMidYMid slice" className="size-full">
          <rect width="60" height="40" fill="#20603D" />
          <rect width="60" height="30" fill="#FAD201" />
          <rect width="60" height="20" fill="#00A1DE" />
          <g fill="#FAD201" transform="translate(43 10)">
            <circle r="3.4" />
            {Array.from({ length: 12 }, (_, i) => (
              <path key={i} d="M0-6.4 L0.9-3.6 L-0.9-3.6Z" transform={`rotate(${i * 30})`} />
            ))}
          </g>
        </svg>
      )}
      {locale === "fr" && (
        <svg viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice" className="size-full">
          <rect width="1" height="2" fill="#0055A4" />
          <rect x="1" width="1" height="2" fill="#FFFFFF" />
          <rect x="2" width="1" height="2" fill="#EF4135" />
        </svg>
      )}
      {locale === "en" && (
        <svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" className="size-full">
          <clipPath id={clip}>
            <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
          </clipPath>
          <rect width="60" height="30" fill="#012169" />
          <path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFFFFF" strokeWidth="6" />
          <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${clip})`} stroke="#C8102E" strokeWidth="4" />
          <path d="M30,0 v30 M0,15 h60" stroke="#FFFFFF" strokeWidth="10" />
          <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
        </svg>
      )}
    </span>
  );
}
