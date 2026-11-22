import { BadgeCheck, Clock, Wallet } from "lucide-react";
import { requireWorkArea } from "@/features/hosting/work";
import { getLocale, getTranslations } from "next-intl/server";
import { Chip, StatTiles } from "@/features/admin/components/kit";
import { Panel } from "@/features/admin/components/ui";
import { hostEarnings } from "@/features/ledger/service";
import { PayoutForm } from "@/features/places/components/PayoutForm";
import { payoutAccountOf } from "@/features/places/payout-service";
import { formatRWF } from "@/lib/format";

export async function generateMetadata() {
  const t = await getTranslations("Places");
  return { title: t("payoutTitle") };
}

/**
 * The owner's money, like the staff Money page: what they're owed, what's coming and what's been paid on top; beside
 * that where VIIPA sends it (checked by staff before places go live) and the payouts so far.
 */
export default async function PayoutPage() {
  const { user } = await requireWorkArea("payout", "/host/payout");
  const [t, tDash, account, earnings, locale] = await Promise.all([getTranslations("Places"), getTranslations("Host.dash"), payoutAccountOf(user.id), hostEarnings(user.id), getLocale()]);
  const rwf = (n: number) => formatRWF(n, locale);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Africa/Kigali" });
  return (
    <div className="flex flex-col gap-6">
      <StatTiles
        format={rwf}
        items={[
          { label: tDash("due"), count: earnings.due, tone: "text-primary" },
          { label: tDash("upcoming"), count: earnings.upcoming },
          { label: tDash("paidOut"), count: earnings.paidOut, tone: "text-emerald-700" },
        ]}
      />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title={t("payoutDetails")}>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {account ? (
              <Chip tone={account.verifiedAt ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}>
                <span className="inline-flex items-center gap-1.5">
                  {account.verifiedAt ? <BadgeCheck className="size-3.5" aria-hidden="true" /> : <Clock className="size-3.5" aria-hidden="true" />}
                  {account.verifiedAt ? t("payoutVerified") : t("payoutPending")}
                </span>
              </Chip>
            ) : (
              <Chip tone="bg-amber-50 text-amber-900">{tDash("payoutMissing")}</Chip>
            )}
          </div>
          <p className="mb-4 text-[13px] text-muted">{t("payoutIntro")}</p>
          <PayoutForm initial={account && { method: account.method, accountName: account.accountName, accountNumber: account.accountNumber, bankName: account.bankName }} />
        </Panel>
        <Panel title={tDash("recentPayouts")} flush>
          {earnings.payouts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Wallet className="size-7 text-line-strong" aria-hidden="true" />
              <p className="text-[13px] text-muted">{tDash("noPayouts")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {earnings.payouts.map((p) => (
                <li key={p.reference} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="min-w-0">
                    <span className="block font-mono text-[13px] font-semibold text-ink">{p.reference}</span>
                    <span className="block text-[12px] text-muted">
                      {date.format(p.createdAt)}
                      {p.method && ` · ${p.method}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-[14px] font-semibold text-emerald-700 tabular-nums">{rwf(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
