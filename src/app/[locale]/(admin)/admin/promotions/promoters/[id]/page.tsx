import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Chip, StatTiles } from "@/features/admin/components/kit";
import { PageIntro, Panel, Table, td } from "@/features/admin/components/ui";
import { StatusBadge } from "@/features/bookings/components/StatusBadge";
import { formatStayDates } from "@/features/bookings/format";
import { maskAccount } from "@/features/places/payout-service";
import { PromoterRewardButtons } from "@/features/promoters/components/StaffPromoterButtons";
import { endExpiredPromoters } from "@/features/promoters/service";
import { promoterMoney, promoState } from "@/features/promotions/discount";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import { formatRWF } from "@/lib/format";
import { requireStaff } from "@/lib/permissions";

type Props = { params: Promise<{ id: string }> };
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * One promoter: every client who booked through them (their promo codes or their QR link), what each booking earned
 * them, and the money in total. Staff approve each reward here, then mark it paid once sent.
 */
export default async function PromoterPage({ params }: Props) {
  const { id } = await params;
  await requireStaff("promotions", `/admin/promotions/promoters/${id}`);
  const now = new Date();
  await endExpiredPromoters(now);
  const p = await db.promoter.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      promoCodes: { orderBy: { createdAt: "desc" }, select: { id: true, code: true, active: true, startsAt: true, endsAt: true, maxUses: true, usedCount: true, percentOff: true, amountOff: true, promoterBps: true } },
      rewards: { select: { id: true, amount: true, status: true, paidAt: true, bookingId: true } },
      bookings: {
        orderBy: { createdAt: "desc" },
        take: 300,
        select: {
          id: true,
          reference: true,
          status: true,
          checkIn: true,
          checkOut: true,
          total: true,
          guest: { select: { id: true, name: true, email: true } },
          listing: { select: { title: true } },
          promoCode: { select: { code: true } },
        },
      },
    },
  });
  if (!p) notFound();
  const [t, tP, tMoney, tBookings, locale] = await Promise.all([getTranslations("Promotions"), getTranslations("Promoters"), getTranslations("Money"), getTranslations("Bookings"), getLocale()]);
  const rwf = (n: number) => formatRWF(n, locale);
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Africa/Kigali" });
  const money = promoterMoney(p.rewards);
  const rewardOf = new Map(p.rewards.map((r) => [r.bookingId, r]));
  const paidStays = p.bookings.filter((b) => ["CONFIRMED", "CHECKED_IN", "COMPLETED"].includes(b.status));

  return (
    <div className="flex flex-col gap-5">
      <PageIntro back={{ href: "/admin/promotions?tab=promoters", label: tP("backToPromoters") }} />
      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-5">
        <div className="min-w-0 flex-1">
          <Link href={`/admin/users/${p.user.id}`} className="block text-[18px] font-bold text-ink hover:text-primary">
            {p.user.name}
          </Link>
          <p className="text-[13px] text-muted">
            {p.user.email} · <span className="font-mono">{p.code}</span>
          </p>
          <p className="mt-1 text-[13px] text-ink">{p.startsAt && p.endsAt ? tP("periodLine", { from: day.format(p.startsAt), until: day.format(p.endsAt) }) : tP("noPeriod")}</p>
          {p.payoutNumber && (
            <p className="text-[13px] text-muted">
              {tP("payTo")}: {p.payoutMethod === "BANK" ? `${p.bankName ?? ""} ` : ""}
              {p.payoutName ?? ""} {maskAccount(p.payoutNumber)}
            </p>
          )}
        </div>
        <Chip>{tP(`status.${p.status}`)}</Chip>
      </section>

      {/* Their codes, each with where it is now. */}
      {p.promoCodes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {p.promoCodes.map((c) => {
            const state = promoState(c, now);
            return (
              <Link
                key={c.id}
                href={`/admin/promotions/codes/${c.id}`}
                className={cn("inline-flex items-center gap-2 rounded-xl border-2 border-dashed px-3 py-1.5 text-[13px] hover:border-primary", state === "active" ? "border-primary/40 bg-primary/[0.06] text-primary" : "border-line-strong bg-canvas text-muted")}
              >
                <b className="font-mono font-bold">{c.code}</b>
                <span className="font-semibold">{t(`state.${state}`)}</span>
                {c.endsAt && <span className="text-[12px]">{t("until", { date: day.format(c.endsAt) })}</span>}
              </Link>
            );
          })}
        </div>
      )}

      <StatTiles
        format={rwf}
        items={[
          { label: t("stats.clients"), count: new Set(paidStays.map((b) => b.guest.id)).size, plain: true },
          { label: tP("money.made"), count: money.made, tone: "text-emerald-700" },
          { label: tP("money.toApprove"), count: money.toApprove, tone: money.toApprove > 0 ? "text-amber-700" : undefined },
          { label: tP("money.toPay"), count: money.toPay },
          { label: tP("money.paid"), count: money.paid },
        ]}
      />

      <Panel title={tP("broughtTitle", { count: p.bookings.length })} flush>
        <Table
          head={[t("col.client"), t("col.stay"), tP("broughtBy"), t("col.paid"), t("col.reward"), t("col.status")]}
          empty={p.bookings.length === 0 ? <p className="py-10 text-center text-[14px] text-muted">{t("noBookingsYet")}</p> : null}
        >
          {p.bookings.map((b) => {
            const r = rewardOf.get(b.id);
            return (
              <tr key={b.reference} className="hover:bg-canvas/60">
                <td className={td}>
                  <Link href={`/admin/users/${b.guest.id}`} className="block font-semibold text-ink hover:text-primary">
                    {b.guest.name}
                  </Link>
                  <span className="block text-[12px] text-muted">{b.guest.email}</span>
                </td>
                <td className={td}>
                  <Link href={`/admin/bookings/${b.reference}`} className="font-mono text-[12px] font-semibold text-primary hover:underline">
                    {b.reference}
                  </Link>
                  <span className="block max-w-[220px] truncate text-[12.5px] text-ink">{b.listing.title}</span>
                  <span className="block text-[12px] text-muted">{formatStayDates(locale, iso(b.checkIn), iso(b.checkOut))}</span>
                </td>
                <td className={td}>{b.promoCode ? <span className="font-mono text-[12.5px] font-semibold">{b.promoCode.code}</span> : <span className="text-[12.5px] text-muted">{tP("viaQr")}</span>}</td>
                <td className={`${td} tabular-nums`}>{rwf(b.total)}</td>
                <td className={`${td} tabular-nums`}>
                  {r ? (
                    <span className="flex flex-col items-start gap-1.5">
                      <b className="font-semibold text-ink">{rwf(r.amount)}</b>
                      <span className="text-[11.5px] text-muted">{tMoney(`promo.rewardStatus.${r.paidAt ? "PAID" : r.status}` as "promo.rewardStatus.PENDING")}</span>
                      {/* Approve to give them this money, then mark it paid once sent. */}
                      {(r.status === "PENDING" || (r.status === "APPROVED" && !r.paidAt)) && <PromoterRewardButtons rewardId={r.id} status={r.status === "PENDING" ? "PENDING" : "APPROVED"} />}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={td}>
                  <StatusBadge status={b.status} label={tBookings(`status.${b.status}`)} />
                </td>
              </tr>
            );
          })}
        </Table>
      </Panel>
    </div>
  );
}
