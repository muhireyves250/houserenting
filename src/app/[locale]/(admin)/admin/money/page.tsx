import { getLocale, getTranslations } from "next-intl/server";
import { PayoutForm, RewardButtons } from "@/features/admin/components/MoneyControls";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { ownerBalances, recentLedger } from "@/features/ledger/service";
import { paymentsToReview } from "@/features/payments/service";
import { pendingRewards } from "@/features/referrals/service";
import { dynamicMessage } from "@/lib/dynamic-message";
import { getEnv } from "@/lib/env";
import { formatRWF } from "@/lib/format";
import { requireAdmin } from "@/lib/permissions";

const card = "rounded-3xl bg-surface p-5 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line";

export default async function AdminMoneyPage() {
  await requireAdmin("/admin/money");
  const [t, locale, balances, rewards, problems, ledger] = await Promise.all([
    getTranslations("Money"),
    getLocale(),
    ownerBalances(),
    pendingRewards(),
    paymentsToReview(),
    recentLedger(50),
  ]);
  const connected = Boolean(getEnv().PAYMENT_WEBHOOK_SECRET);
  const rwf = (n: number) => formatRWF(n, locale);

  return (
    <div className="flex flex-col gap-8">
      {!connected && <p className="rounded-2xl bg-amber-50 px-5 py-3.5 text-sm text-amber-900 ring-1 ring-amber-200/70">{t("notConnected")}</p>}

      <section>
        <h2 className="mb-1 text-lg font-bold text-ink">{t("owners")}</h2>
        <p className="mb-3 text-[13px] text-muted">{t("ownersHint")}</p>
        {balances.length === 0 && <p className="py-6 text-center text-[15px] text-muted">{t("nothing")}</p>}
        <ul className="flex flex-col gap-3">
          {balances.map((b) => (
            <li key={b.hostId} className={`${card} flex flex-wrap items-center justify-between gap-3`}>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-ink">{b.name}</p>
                <p className="text-[13px] text-muted">{b.email}</p>
                <p className="mt-1 text-[13px] text-ink/80 tabular-nums">
                  {t("balanceLine", { due: rwf(b.due), upcoming: rwf(b.upcoming), paid: rwf(b.paidOut) })}
                  {b.depositsHeld > 0 && ` · ${t("depositsHeld", { amount: rwf(b.depositsHeld) })}`}
                </p>
              </div>
              <PayoutForm hostId={b.hostId} due={b.due} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">{t("rewards")}</h2>
        {rewards.length === 0 && <p className="py-6 text-center text-[15px] text-muted">{t("nothing")}</p>}
        <ul className="flex flex-col gap-3">
          {rewards.map((r) => (
            <li key={r.id} className={`${card} flex flex-wrap items-center justify-between gap-3`}>
              <p className="text-[15px] text-ink">
                {t("rewardLine", { referrer: r.referrer.name, friend: r.referee.name, amount: rwf(r.amount) })}
                <span className="block text-[13px] text-muted">{r.booking.reference}</span>
              </p>
              <RewardButtons rewardId={r.id} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">{t("problems")}</h2>
        {problems.length === 0 && <p className="py-6 text-center text-[15px] text-muted">{t("nothing")}</p>}
        <ul className="flex flex-col gap-2">
          {problems.map((p) => {
            const body = p.payload as { bookingReference?: string; amount?: number; providerReference?: string };
            return (
              <li key={p.id} className={card}>
                <p className="text-[15px] font-semibold text-ink">{dynamicMessage(t, `outcome.${p.outcome}`, p.outcome)}</p>
                <p className="text-[13px] text-muted">
                  {body.bookingReference} · {rwf(body.amount ?? 0)} · {p.provider} {body.providerReference} · {formatKigaliDateTime(locale, p.receivedAt)}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">{t("ledger")}</h2>
        {ledger.length === 0 && <p className="py-6 text-center text-[15px] text-muted">{t("nothing")}</p>}
        <ol className="divide-y divide-line rounded-3xl bg-surface px-5 ring-1 ring-line">
          {ledger.map((e) => (
            <li key={e.id} className="flex flex-wrap justify-between gap-2 py-2.5 text-[13px] tabular-nums">
              <span className="text-ink">
                <b className="font-semibold">{dynamicMessage(t, `kind.${e.kind}`, e.kind)}</b> · {e.booking?.reference ?? e.settlement?.reference}
              </span>
              <span className="text-ink">
                {rwf(e.amount)} <span className="ml-2 text-muted">{formatKigaliDateTime(locale, e.createdAt)}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
