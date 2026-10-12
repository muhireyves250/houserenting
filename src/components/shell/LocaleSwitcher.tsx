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
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted transition-colors duration-300 hover:bg-ink/[0.05]",
        "group-data-[overlay=true]/header:text-white/90 group-data-[overlay=true]/header:hover:bg-white/15",
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
