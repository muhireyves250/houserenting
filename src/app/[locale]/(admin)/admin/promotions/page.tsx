import { getLocale, getTranslations } from "next-intl/server";
import { PromoForm, PromoToggle } from "@/features/admin/components/PromoForm";
import { listPromos } from "@/features/promotions/service";
import { formatRWF } from "@/lib/format";
import { requireAdmin } from "@/lib/permissions";
import { PageIntro } from "@/features/admin/components/ui";
import { cn } from "@/lib/cn";

export default async function AdminPromotionsPage() {
  await requireAdmin("/admin/promotions");
  const [t, tIntro, locale, promos] = await Promise.all([getTranslations("Promotions"), getTranslations("Admin"), getLocale(), listPromos()]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Africa/Kigali" });
  return (
    <div className="flex flex-col gap-6">
      <PageIntro description={tIntro("promotionsIntro")} />
      <PromoForm />
      <ul className="divide-y divide-line rounded-3xl bg-surface px-5 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line">
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
  );
}
