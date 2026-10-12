"use client";

import { Globe } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, toAppLocale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("Locale");
  const tNav = useTranslations("Nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  return (
    <label
      className={cn(
        "flex h-11 items-center gap-1.5 rounded-full border border-primary/60 px-4 text-[15px] font-semibold tracking-[0.01em] text-primary transition-colors duration-300 hover:border-primary hover:bg-primary/[0.06]",
        "group-data-[overlay=true]/header:border-[#8cc0ff] group-data-[overlay=true]/header:text-white/90 group-data-[overlay=true]/header:hover:bg-white/10",
        className,
      )}
    >
      <Globe className="size-4" aria-hidden="true" />
      <span className="sr-only">{tNav("language")}</span>
      <select
        value={locale}
        disabled={isPending}
        onChange={(event) => {
          const next = toAppLocale(event.target.value);
          startTransition(() => {
            router.replace({ pathname, query: Object.fromEntries(searchParams) }, { locale: next });
          });
        }}
        className="cursor-pointer bg-transparent text-ink outline-none group-data-[overlay=true]/header:text-white"
      >
        {routing.locales.map((value) => (
          <option key={value} value={value} className="text-ink">
            {t(value)}
          </option>
        ))}
      </select>
    </label>
  );
}
