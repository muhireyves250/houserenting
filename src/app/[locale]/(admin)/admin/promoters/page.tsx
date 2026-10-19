import { getLocale, getTranslations } from "next-intl/server";
import { PageIntro, Panel, Table, td } from "@/features/admin/components/ui";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { PromoterRewardButtons, PromoterStatusButtons } from "@/features/promoters/components/StaffPromoterButtons";
import { allPromoters, openPromoterRewards } from "@/features/promoters/service";
import { maskAccount } from "@/features/places/payout-service";
import { Link } from "@/i18n/navigation";
import { formatRWF } from "@/lib/format";
import { requireAdmin } from "@/lib/permissions";

/** Promoters (approve, suspend) and their rewards (approve, mark paid). Reward rules are in Settings. */
export default async function AdminPromotersPage() {
  await requireAdmin("/admin/promoters");
  const [t, tP, locale, promoters, rewards] = await Promise.all([getTranslations("Admin"), getTranslations("Promoters"), getLocale(), allPromoters(), openPromoterRewards()]);
  const empty = <p className="py-8 text-center text-[14px] text-muted">{t("nothingHere")}</p>;
  return (
    <div className="flex flex-col gap-5">
      <PageIntro description={tP("adminIntro")} />
      <Panel title={tP("rewardsTitle")} flush>
        <Table head={[tP("promoter"), t("col.reference"), t("col.total"), tP("payTo"), ""]} empty={rewards.length === 0 ? empty : null}>
          {rewards.map((r) => (
            <tr key={r.id}>
              <td className={td}>
                {r.promoter.user.name}
                <span className="block font-mono text-xs text-muted">{r.promoter.code}</span>
              </td>
              <td className={td}>
                <Link href={`/admin/bookings/${r.booking.reference}`} className="font-mono text-[13px] font-semibold text-primary hover:underline">
                  {r.booking.reference}
                </Link>
              </td>
              <td className={`${td} tabular-nums`}>{formatRWF(r.amount, locale)}</td>
              <td className={td}>
                {r.promoter.payoutNumber ? `${r.promoter.payoutMethod === "BANK" ? `${r.promoter.bankName ?? ""} ` : ""}${r.promoter.payoutName ?? ""} ${maskAccount(r.promoter.payoutNumber)}` : "—"}
              </td>
              <td className={td}>
                <PromoterRewardButtons rewardId={r.id} status={r.status === "PENDING" ? "PENDING" : "APPROVED"} />
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
      <Panel title={tP("promotersTitle")} flush>
        <Table head={[tP("promoter"), tP("code"), tP("visits"), tP("bookings"), tP("since"), t("col.status")]} empty={promoters.length === 0 ? empty : null}>
          {promoters.map((p) => (
            <tr key={p.id}>
              <td className={td}>
                <Link href={`/admin/users/${p.user.id}`} className="font-semibold text-primary hover:underline">
                  {p.user.name}
                </Link>
                {p.about && <span className="block max-w-xs truncate text-xs text-muted">{p.about}</span>}
              </td>
              <td className={`${td} font-mono text-[13px]`}>{p.code}</td>
              <td className={td}>{p._count.visits}</td>
              <td className={td}>{p._count.bookings}</td>
              <td className={`${td} whitespace-nowrap`}>{formatKigaliDateTime(locale, p.createdAt)}</td>
              <td className={td}>
                <span className="mb-1 block text-xs font-semibold text-muted">{tP(`status.${p.status}`)}</span>
                <PromoterStatusButtons promoterId={p.id} status={p.status} />
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
