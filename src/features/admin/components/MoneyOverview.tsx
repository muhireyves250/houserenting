import { getLocale, getTranslations } from "next-intl/server";
import { moneyOverview } from "@/features/ledger/service";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";

/**
 * Money at a glance, in three plain groups (requirements 5.1, 5.4): what came in and what VIIPA earns; what owners
 * and providers are owed now, later, and were paid; commissions, refunds and expenses. Only commission and fees are
 * VIIPA's revenue, never the whole payment.
 */
export async function MoneyOverview() {
  const [t, locale, m] = await Promise.all([getTranslations("Money.overview"), getLocale(), moneyOverview()]);
  const rwf = (n: number) => formatRWF(n, locale);
  const groups: { title: string; items: { label: string; value: number; hint?: string; tone?: string }[] }[] = [
    {
      title: t("in"),
      items: [
        { label: t("received"), value: m.received, hint: t("receivedHint") },
        { label: t("revenue"), value: m.revenue, hint: t("revenueHint"), tone: "text-primary" },
        { label: t("net"), value: m.net, hint: t("netHint"), tone: m.net >= 0 ? "text-emerald-700" : "text-red-700" },
      ],
    },
    {
      title: t("owed"),
      items: [
        { label: t("dueNow"), value: m.dueNow, hint: t("dueNowHint"), tone: m.dueNow > 0 ? "text-amber-700" : undefined },
        { label: t("dueLater"), value: m.dueLater, hint: t("dueLaterHint") },
        { label: t("paidOut"), value: m.paidOut, hint: t("paidOutHint"), tone: "text-emerald-700" },
      ],
    },
    {
      title: t("costs"),
      items: [
        { label: t("promoterOwed"), value: m.promoterOwed, hint: t("paidSoFar", { amount: rwf(m.promoterPaid) }) },
        { label: t("referralOwed"), value: m.referralOwed, hint: t("paidSoFar", { amount: rwf(m.referralPaid) }) },
        { label: t("refunds"), value: m.refunds },
        { label: t("expenses"), value: m.expenses },
      ],
    },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {groups.map((g) => (
        <section key={g.title} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
          <h2 className="mb-3 text-[13px] font-bold tracking-wide text-muted uppercase">{g.title}</h2>
          <dl className="flex flex-col divide-y divide-line">
            {g.items.map((i) => (
              <div key={i.label} className="flex items-baseline justify-between gap-3 py-2">
                <dt className="min-w-0">
                  <span className="block text-[14px] font-semibold text-ink">{i.label}</span>
                  {i.hint && <span className="block text-[12px] text-muted">{i.hint}</span>}
                </dt>
                <dd className={cn("shrink-0 text-[17px] font-bold tabular-nums", i.tone ?? "text-ink")}>{rwf(i.value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
