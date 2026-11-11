import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { BackButton } from "./BackButton";
import { cn } from "@/lib/cn";

/**
 * Phones only: the top of a page — a brand-blue band fading into the page, a round back button (and an optional
 * action on the right), the page's icon and its big centred title. Desktop keeps the page's own heading.
 * Put it first inside the page's PageContainer (which drops its top padding on phones: `max-md:pt-0`).
 */
export function PageHero({
  title,
  icon: Icon,
  visual,
  photo,
  subtitle,
  action,
  className,
}: {
  title: string;
  icon?: LucideIcon;
  /** Shown instead of the icon (e.g. the person's photo). */
  visual?: ReactNode;
  /** Background photo (e.g. the place you're staying at), darkened so the white text stays readable. */
  photo?: string | null;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("Nav");
  const onPhoto = Boolean(photo);
  return (
    <header
      data-print-hide
      className={cn(
        "relative -mx-4 mb-4 overflow-hidden px-4 pt-[calc(12px+env(safe-area-inset-top))] pb-6 md:hidden",
        onPhoto ? "min-h-64 rounded-b-[28px] bg-ink pb-7" : "bg-gradient-to-b from-primary via-primary/45 to-canvas",
        className,
      )}
    >
      {photo && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- full-bleed cover from Cloudinary/Unsplash */}
          <img src={photo} alt="" className="absolute inset-0 size-full object-cover" />
          <span className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/70" aria-hidden="true" />
        </>
      )}
      <div className="relative flex h-11 items-center justify-between">
        <BackButton label={t("back")} />
        {action}
      </div>
      <div className="relative mt-2 flex flex-col items-center text-center">
        {visual ??
          (Icon && (
            <span className="flex size-14 items-center justify-center rounded-full bg-white text-primary shadow-[0_8px_20px_-10px_rgba(0,30,80,0.55)]">
              <Icon className="size-7" strokeWidth={1.8} aria-hidden="true" />
            </span>
          ))}
        <h1 className={cn("mt-3 text-[28px] leading-9 font-bold tracking-[-0.03em]", onPhoto ? "text-white drop-shadow" : "text-ink")}>{title}</h1>
        {subtitle && <p className={cn("mt-0.5 text-[14px]", onPhoto ? "text-white/90" : "text-ink/65")}>{subtitle}</p>}
      </div>
    </header>
  );
}
