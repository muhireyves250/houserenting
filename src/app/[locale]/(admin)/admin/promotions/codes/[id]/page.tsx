import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Chip, StatTiles } from "@/features/admin/components/kit";
import { PromoShareInput } from "@/features/admin/components/PromoShareInput";
import { PageIntro, Panel, Table, td } from "@/features/admin/components/ui";
import { StatusBadge } from "@/features/bookings/components/StatusBadge";
import { formatStayDates } from "@/features/bookings/format";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatRWF } from "@/lib/format";
import { requireStaff } from "@/lib/permissions";

type Props = { params: Promise<{ id: string }> };
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** One promo code: who owns it (a promoter, or VIIPA), every client who booked with it, and the rewards it earned. */
export default async function PromoCodePage({ params }: Props) {
  const { id } = await params;
  await requireStaff("promotions", `/admin/promotions/codes/${id}`);
  const promo = await db.promoCode.findUnique({
    where: { id },
    include: {
      promoter: {
        select: {
          id: true,
          code: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
      bookings: {
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          reference: true,
          status: true,
          checkIn: true,
          checkOut: true,
          subtotal: true,
          discount: true,
          total: true,
          guest: { select: { id: true, name: true, email: true } },
          listing: { select: { title: true } },
          promoterReward: {
            select: { amount: true, status: true, paidAt: true },
          },
        },
      },
    },
  });
  if (!promo) notFound();
  const [t, tMoney, tBookings, locale] = await Promise.all([
    getTranslations("Promotions"),
    getTranslations("Money"),
    getTranslations("Bookings"),
    getLocale(),
  ]);
  const rwf = (n: number) => formatRWF(n, locale);
  const paidStays = promo.bookings.filter((b) =>
    ["CONFIRMED", "CHECKED_IN", "COMPLETED"].includes(b.status),
  );
  const rewards = promo.bookings
    .map((b) => b.promoterReward)
    .filter((r): r is NonNullable<typeof r> => Boolean(r));
  const share = (subtotal: number) =>
    promo.promoterBps ? Math.round((subtotal * promo.promoterBps) / 10_000) : 0;
  const coming = paidStays
    .filter((b) => !b.promoterReward && b.status !== "COMPLETED")
    .reduce((n, b) => n + share(b.subtotal), 0);

  return (
    <div className="flex flex-col gap-5">
      <PageIntro
        back={{ href: "/admin/promotions", label: t("backToCodes") }}
      />
      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-5">
        <span className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/[0.06] px-4 py-2 font-mono text-[20px] font-bold text-primary">
          {promo.code}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-bold text-ink">
            {t("offLabel", {
              value: promo.percentOff
                ? `${promo.percentOff}%`
                : rwf(promo.amountOff ?? 0),
            })}
          </p>
          <p className="text-[13px] text-muted">
            {t("uses", { used: promo.usedCount, max: promo.maxUses ?? "∞" })}
          </p>
        </div>
        {/* Who owns it: a promoter (with their share), or VIIPA's own code. */}
        {promo.promoter ? (
          <Link
            href={`/admin/users/${promo.promoter.user.id}`}
            className="rounded-xl bg-canvas px-4 py-2.5 hover:ring-1 hover:ring-primary"
          >
            <span className="block text-[11px] font-semibold text-muted uppercase">
              {t("owner")}
            </span>
            <span className="block text-[14px] font-semibold text-ink">
              {promo.promoter.user.name}
            </span>
            <span className="block text-[12px] text-muted">
              {promo.promoter.user.email}
              {promo.promoterBps
                ? ` · ${t("shareLine", { percent: promo.promoterBps / 100 })}`
                : ""}
            </span>
          </Link>
        ) : (
          <Chip>{t("viipaCode")}</Chip>
        )}
      </section>

      {/* The promoter's share of each booking with this code (changes count for bookings not finished yet). */}
      {promo.promoter && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-5 py-3">
          <PromoShareInput
            promoId={promo.id}
            value={promo.promoterBps === null ? null : promo.promoterBps / 100}
          />
          {!promo.promoterBps && (
            <span className="text-[12.5px] font-medium text-amber-800">
              {t("noShareYet")}
            </span>
          )}
        </div>
      )}
      <StatTiles
        format={rwf}
        items={[
          {
            label: t("stats.clients"),
            count: new Set(paidStays.map((b) => b.guest.id)).size,
            plain: true,
          },
          {
            label: t("stats.discounts"),
            count: paidStays.reduce((n, b) => n + b.discount, 0),
          },
          ...(promo.promoter
            ? [
                { label: t("stats.coming"), count: coming },
                {
                  label: t("stats.earned"),
                  count: rewards.reduce((n, r) => n + r.amount, 0),
                  tone: "text-emerald-700",
                },
              ]
            : []),
        ]}
      />

      <Panel
        title={t("bookingsWithCode", { count: promo.bookings.length })}
        flush
      >
        <Table
          head={[
            t("col.client"),
            t("col.stay"),
            t("col.paid"),
            t("col.discount"),
            ...(promo.promoter ? [t("col.reward")] : []),
            t("col.status"),
          ]}
          empty={
            promo.bookings.length === 0 ? (
              <p className="py-10 text-center text-[14px] text-muted">
                {t("noBookingsYet")}
              </p>
            ) : null
          }
        >
          {promo.bookings.map((b) => (
            <tr key={b.reference} className="hover:bg-canvas/60">
              <td className={td}>
                <Link
                  href={`/admin/users/${b.guest.id}`}
                  className="block font-semibold text-ink hover:text-primary"
                >
                  {b.guest.name}
                </Link>
                <span className="block text-[12px] text-muted">
                  {b.guest.email}
                </span>
              </td>
              <td className={td}>
                <Link
                  href={`/admin/bookings/${b.reference}`}
                  className="font-mono text-[12px] font-semibold text-primary hover:underline"
                >
                  {b.reference}
                </Link>
                <span className="block max-w-[220px] truncate text-[12.5px] text-ink">
                  {b.listing.title}
                </span>
                <span className="block text-[12px] text-muted">
                  {formatStayDates(locale, iso(b.checkIn), iso(b.checkOut))}
                </span>
              </td>
              <td className={`${td} tabular-nums`}>{rwf(b.total)}</td>
              <td className={`${td} tabular-nums`}>−{rwf(b.discount)}</td>
              {promo.promoter && (
                <td className={`${td} tabular-nums`}>
                  {b.promoterReward ? (
                    <>
                      <b className="font-semibold text-ink">
                        {rwf(b.promoterReward.amount)}
                      </b>
                      <span className="block text-[11.5px] text-muted">
                        {tMoney(
                          `promo.rewardStatus.${b.promoterReward.paidAt ? "PAID" : b.promoterReward.status}` as "promo.rewardStatus.PENDING",
                        )}
                      </span>
                    </>
                  ) : share(b.subtotal) > 0 &&
                    ["CONFIRMED", "CHECKED_IN"].includes(b.status) ? (
                    <span className="text-[12.5px] text-muted">
                      {tMoney("promo.rewardLater", {
                        amount: rwf(share(b.subtotal)),
                      })}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              )}
              <td className={td}>
                <StatusBadge
                  status={b.status}
                  label={tBookings(`status.${b.status}`)}
                />
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
