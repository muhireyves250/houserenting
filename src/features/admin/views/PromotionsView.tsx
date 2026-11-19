import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { FillScreen } from "@/features/admin/components/kit";
import { PromoForm, PromoToggle } from "@/features/admin/components/PromoForm";
import { listPromos } from "@/features/promotions/service";
import { formatRWF } from "@/lib/format";
import { cn } from "@/lib/cn";

export async function PromotionsView({ tabs }: { tabs: ReactNode }) {
  const [t, locale, promos] = await Promise.all([getTranslations("Promotions"), getLocale(), listPromos()]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Africa/Kigali" });
  return (
    <FillScreen>
      {tabs}
      {/* Computers: the new-code form beside the list, each scrolling in its own box. Phones: the form folds away. */}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[400px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
        <details className="group shrink-0 rounded-2xl bg-surface ring-1 ring-line lg:hidden">
          <summary className="cursor-pointer px-4 py-3 text-[15px] font-semibold text-primary">+ {t("newCode")}</summary>
          <div className="border-t border-line p-3">
            <PromoForm />
          </div>
        </details>
        <div className="no-scrollbar hidden min-h-0 overflow-y-auto lg:block">
          <PromoForm />
        </div>
        <ul className="no-scrollbar min-h-0 divide-y divide-line overflow-y-auto overscroll-contain rounded-2xl bg-surface px-5 ring-1 ring-line">
        {promos.length === 0 && <li className="py-8 text-center text-[15px] text-muted">{t("none")}</li>}
        {promos.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span className="min-w-0">
              <span className={cn("font-mono text-[15px] font-bold", p.active ? "text-ink" : "text-muted line-through")}>{p.code}</span>
              <span className="block text-[13px] text-muted">
                {p.percentOff ? `${p.percentOff}%` : formatRWF(p.amountOff ?? 0, locale)} · {t(`funding.${p.fundedBy}`)} ·{" "}
                {t("uses", { used: p.usedCount, max: p.maxUses ?? "∞" })}
                {p.endsAt && ` · ${t("until", { date: date.format(p.endsAt) })}`}
              </span>
              {p.description && <span className="block text-[13px] text-ink/80">{p.description}</span>}
            </span>
            <PromoToggle id={p.id} active={p.active} />
          </li>
        ))}
      </ul>
      </div>
    </FillScreen>
  );
}
