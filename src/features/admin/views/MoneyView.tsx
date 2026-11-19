import { Download, Receipt } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { adminCard, Chip, StatTiles } from "@/features/admin/components/kit";
import { PayoutForm, RewardButtons } from "@/features/admin/components/MoneyControls";
import { Pagination } from "@/features/admin/components/ui";
import { allPayments } from "@/features/admin/queries";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { ownerBalances, recentLedger } from "@/features/ledger/service";
import { paymentsToReview } from "@/features/payments/service";
import { pendingRewards } from "@/features/referrals/service";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { dynamicMessage } from "@/lib/dynamic-message";
import { getEnv } from "@/lib/env";
import { formatRWF } from "@/lib/format";

type Props = { searchParams: Promise<{ page?: string }> };

const PAY_TONE: Record<string, string> = {
  SUCCEEDED: "bg-emerald-100 text-emerald-800",
  PENDING: "bg-amber-100 text-amber-900",
  FAILED: "bg-red-50 text-red-700",
  REFUNDED: "bg-canvas text-ink",
};

/**
 * Money at a glance for staff: totals on top, each owner with what they're owed and the payout button, then what
 * needs a decision, the latest payments, and the ledger grouped one line per payment (folded).
 */
export async function MoneyView({ searchParams }: { searchParams: Props["searchParams"] }) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const [t, tAdmin, locale, balances, rewards, problems, ledger, payments] = await Promise.all([
    getTranslations("Money"),
    getTranslations("Admin"),
    getLocale(),
    ownerBalances(),
    pendingRewards(),
    paymentsToReview(),
    recentLedger(150),
    allPayments(page),
  ]);
  const connected = Boolean(getEnv().PAYMENT_WEBHOOK_SECRET);
  const rwf = (n: number) => formatRWF(n, locale);
  const sum = (k: "due" | "upcoming" | "paidOut" | "depositsHeld") => balances.reduce((n, b) => n + b[k], 0);

  // The ledger, one group per payment: same booking (or payout), same reason, same moment.
  type Group = { key: string; ref: string; what: string; at: Date; lines: { kind: string; amount: number }[] };
  const groups: Group[] = [];
  for (const e of ledger) {
    const ref = e.booking?.reference ?? e.settlement?.reference ?? "—";
    const what = e.note ?? "";
    const key = `${ref}|${what}|${e.createdAt.toISOString().slice(0, 16)}`;
    const last = groups.at(-1);
    if (last && last.key === key) last.lines.push({ kind: e.kind, amount: e.amount });
    else groups.push({ key, ref, what, at: e.createdAt, lines: [{ kind: e.kind, amount: e.amount }] });
  }
  const whatLabel = (note: string) => (note.startsWith("food ") ? t("forFood", { ref: note.slice(5) }) : note.startsWith("laundry ") ? t("forLaundry", { ref: note.slice(8) }) : t("forStay"));

  return (
    <div className="flex flex-col gap-6">
      {/* Downloads, and how payments come in. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={cn("rounded-full px-3 py-1 text-[12px] font-semibold", connected ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900")}>{connected ? t("connectedShort") : t("manualShort")}</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["/api/v1/admin/export/bookings", t("exportBookings")],
              ["/api/v1/admin/export/payments", t("exportPayments")],
              ["/api/v1/admin/export/ledger", t("exportLedger")],
            ] as const
          ).map(([href, label]) => (
            <a key={href} href={href} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] font-semibold text-ink hover:border-primary">
              <Download className="size-3.5" aria-hidden="true" />
              {label}
            </a>
          ))}
        </div>
      </div>

      <StatTiles
        items={[
          { label: t("tiles.due"), count: sum("due"), tone: "text-primary" },
          { label: t("tiles.upcoming"), count: sum("upcoming") },
          { label: t("tiles.paidOut"), count: sum("paidOut"), tone: "text-emerald-700" },
          { label: t("tiles.deposits"), count: sum("depositsHeld") },
        ]}
        format={rwf}
      />

      {/* Each owner: what they're owed now, later, already paid; and the payout button. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[17px] font-bold text-ink">{t("owners")}</h2>
        {balances.length === 0 ? (
          <p className="rounded-2xl bg-surface py-6 text-center text-[14px] text-muted ring-1 ring-line">{t("nothing")}</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {balances.map((b) => (
              <li key={b.hostId} className={adminCard}>
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-bold text-ink">{b.name}</p>
                  <p className="truncate text-[12px] text-muted">{b.email}</p>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-[13px]">
                  {(
                    [
                      ["due", b.due, "text-primary"],
                      ["upcoming", b.upcoming, "text-ink"],
                      ["paidOut", b.paidOut, "text-emerald-700"],
                      ["deposits", b.depositsHeld, "text-ink"],
                    ] as const
                  ).map(([k, v, tone]) => (
                    <div key={k} className="rounded-xl bg-canvas px-3 py-2">
                      <dt className="text-[11px] font-semibold text-muted">{t(`tiles.${k}`)}</dt>
                      <dd className={cn("font-bold tabular-nums", tone)}>{rwf(v)}</dd>
                    </div>
                  ))}
                </dl>
                <PayoutForm hostId={b.hostId} due={b.due} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Only when something needs a decision. */}
      {rewards.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[17px] font-bold text-ink">{t("rewards")}</h2>
          <ul className="grid gap-3 lg:grid-cols-2">
            {rewards.map((r) => (
              <li key={r.id} className={adminCard}>
                <p className="text-[14px] text-ink">
                  {t("rewardLine", { referrer: r.referrer.name, friend: r.referee.name, amount: rwf(r.amount) })}
                  <span className="block font-mono text-[12px] text-muted">{r.booking.reference}</span>
                </p>
                <RewardButtons rewardId={r.id} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {problems.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[17px] font-bold text-ink">{t("problems")}</h2>
          <ul className="grid gap-3 lg:grid-cols-2">
            {problems.map((pr) => {
              const body = pr.payload as { bookingReference?: string; amount?: number; providerReference?: string };
              return (
                <li key={pr.id} className={cn(adminCard, "ring-red-200")}>
                  <p className="text-[14px] font-semibold text-red-800">{dynamicMessage(t, `outcome.${pr.outcome}`, pr.outcome)}</p>
                  <p className="text-[13px] text-muted">
                    {body.bookingReference} · {rwf(body.amount ?? 0)} · {pr.provider} {body.providerReference} · {formatKigaliDateTime(locale, pr.receivedAt)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* The latest payments from guests. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[17px] font-bold text-ink">{t("paymentsTitle")}</h2>
        {payments.rows.length === 0 ? (
          <p className="rounded-2xl bg-surface py-6 text-center text-[14px] text-muted ring-1 ring-line">{t("nothing")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {payments.rows.map((pay) => (
              <li key={pay.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
                <Link href={`/admin/bookings/${pay.booking.reference}`} className="font-mono text-[13px] font-bold text-primary hover:underline">
                  {pay.booking.reference}
                </Link>
                <span className="min-w-0 flex-1 truncate text-[13px] text-muted">
                  {pay.booking.listing.title} · {pay.provider === "manual" ? t("byHand") : pay.provider} · <span className="font-mono">{pay.providerReference}</span>
                </span>
                <span className="text-[12px] text-muted">{formatKigaliDateTime(locale, pay.createdAt)}</span>
                <span className="w-28 text-right text-[15px] font-bold text-ink tabular-nums">{rwf(pay.amount)}</span>
                <Chip tone={PAY_TONE[pay.status] ?? "bg-canvas text-ink"}>{t(`payStatus.${pay.status as "SUCCEEDED"}`)}</Chip>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} pages={payments.pages} label={(pg, n) => tAdmin("pageOf", { page: pg, pages: n })} hrefFor={(pg) => `/admin/money?page=${pg}`} />
      </section>

      {/* Every money movement, one line per payment, folded. */}
      <details className="rounded-2xl bg-surface px-4 ring-1 ring-line">
        <summary className="flex cursor-pointer items-center gap-2 py-3.5 text-[15px] font-semibold text-ink">
          <Receipt className="size-4 text-primary" aria-hidden="true" />
          {t("ledger")} <span className="text-muted tabular-nums">({groups.length})</span>
        </summary>
        <ol className="flex flex-col divide-y divide-line border-t border-line">
          {groups.map((g) => (
            <li key={g.key} className="flex flex-col gap-1.5 py-3">
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="font-mono font-bold text-ink">{g.ref}</span>
                <span className="text-muted">{whatLabel(g.what)}</span>
                <span className="ml-auto text-[12px] text-muted">{formatKigaliDateTime(locale, g.at)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.lines.map((l, i) => (
                  <Chip key={i} tone={l.kind === "GUEST_PAYMENT" ? "bg-primary/10 text-primary" : l.kind === "HOST_PAYABLE" || l.kind === "SETTLEMENT" ? "bg-emerald-50 text-emerald-800" : "bg-canvas text-ink"}>
                    {dynamicMessage(t, `kind.${l.kind}`, l.kind)} · {rwf(l.amount)}
                  </Chip>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
