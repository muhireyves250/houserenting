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
export function PageHero({ title, icon: Icon, subtitle, action, className }: { title: string; icon: LucideIcon; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  const t = useTranslations("Nav");
  return (
    <header
      data-print-hide
      className={cn(
        "-mx-4 mb-4 bg-gradient-to-b from-primary via-primary/45 to-canvas px-4 pt-[calc(12px+env(safe-area-inset-top))] pb-6 md:hidden",
        className,
      )}
    >
      <div className="flex h-11 items-center justify-between">
        <BackButton label={t("back")} />
        {action}
      </div>
      <div className="mt-2 flex flex-col items-center text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-white text-primary shadow-[0_8px_20px_-10px_rgba(0,30,80,0.55)]">
          <Icon className="size-7" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <h1 className="mt-3 text-[28px] leading-9 font-bold tracking-[-0.03em] text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[14px] text-ink/65">{subtitle}</p>}
      </div>
    </header>
  );
}
