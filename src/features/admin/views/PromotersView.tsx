import { getLocale, getTranslations } from "next-intl/server";
import { ConfirmAction } from "@/features/admin/components/ConfirmAction";
import { adminCard, Chip } from "@/features/admin/components/kit";
import { Panel, Table, td } from "@/features/admin/components/ui";
import { deletePromoterAction } from "@/features/promoters/actions";
import { AddPromoter, EditPromoter } from "@/features/promoters/components/StaffPromoterForm";
import { ApprovePromoter } from "@/features/promoters/components/ApprovePromoter";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { PromoterRewardButtons, PromoterStatusButtons } from "@/features/promoters/components/StaffPromoterButtons";
import { allPromoters, openPromoterRewards } from "@/features/promoters/service";
import { maskAccount } from "@/features/places/payout-service";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";

/** Promoters (approve, suspend) and their rewards (approve, mark paid). Reward rules are in Settings. */
export async function PromotersView() {
  const [t, tP, locale, promoters, rewards] = await Promise.all([getTranslations("Admin"), getTranslations("Promoters"), getLocale(), allPromoters(), openPromoterRewards()]);
  const empty = <p className="py-8 text-center text-[14px] text-muted">{t("nothingHere")}</p>;
  // People who asked to become promoters, waiting for VIIPA (shown first).
  const applications = promoters.filter((p) => p.status === "PENDING");
  const team = promoters.filter((p) => p.status !== "PENDING");
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-[17px] font-bold text-ink">
          {tP("applicationsTitle")}
          <Chip tone={applications.length > 0 ? "bg-amber-100 text-amber-900" : "bg-canvas text-muted"}>{applications.length}</Chip>
        </h2>
        {applications.length === 0 ? (
          <p className="rounded-2xl bg-surface px-4 py-5 text-center text-[13px] text-muted ring-1 ring-line">{tP("applicationsEmpty")}</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {applications.map((p) => (
              <li key={p.id} className={cn(adminCard, "ring-1 ring-amber-200")}>
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <Link href={`/admin/users/${p.user.id}`} className="block truncate text-[16px] font-bold text-ink hover:text-primary">
                      {p.user.name}
                    </Link>
                    <span className="block truncate text-[12px] text-muted">
                      {p.user.email} · {formatKigaliDateTime(locale, p.createdAt)}
                    </span>
                  </span>
                  <Chip tone="bg-amber-100 text-amber-900">{tP("status.PENDING")}</Chip>
                </div>
                {p.about && <p className="rounded-xl bg-canvas px-3 py-2 text-[13px] text-ink">{p.about}</p>}
                {p.payoutNumber && (
                  <p className="text-[13px] text-muted">
                    {tP("payTo")}: {p.payoutMethod === "BANK" ? `${p.bankName ?? ""} ` : ""}
                    {p.payoutName ?? ""} {maskAccount(p.payoutNumber)}
                  </p>
                )}
                <ApprovePromoter promoterId={p.id} />
                <div className="flex justify-end border-t border-line pt-3">
                  <ConfirmAction label={tP("firstCode.decline")} question={tP("firstCode.declineQuestion")} action={deletePromoterAction.bind(null, p.id)} errors={{ hasRewards: tP("staffError.hasRewards") }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {/* Rewards only when some wait to be handled. */}
      {rewards.length > 0 && (
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
      )}
      {/* Each promoter as a card: what they bring, where rewards go, and every action in one place. */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-[17px] font-bold text-ink">
          {tP("promotersTitle")}
          <Chip tone={team.length > 0 ? "bg-primary text-white" : "bg-canvas text-muted"}>{team.length}</Chip>
        </h2>
        <AddPromoter />
        {team.length === 0 ? (
          empty
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {team.map((p) => (
              <li key={p.id} className={adminCard}>
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <Link href={`/admin/users/${p.user.id}`} className="block truncate text-[16px] font-bold text-ink hover:text-primary">
                      {p.user.name}
                    </Link>
                    <span className="block truncate text-[12px] text-muted">{p.user.email}</span>
                  </span>
                  <Chip tone={p.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : p.status === "PENDING" ? "bg-amber-100 text-amber-900" : "bg-red-50 text-red-700"}>{tP(`status.${p.status}`)}</Chip>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Chip>
                    <span className="font-mono">{p.code}</span>
                  </Chip>
                  <Chip>{tP("visitsN", { count: p._count.visits })}</Chip>
                  <Chip>{tP("bookingsN", { count: p._count.bookings })}</Chip>
                  <Chip>{formatKigaliDateTime(locale, p.createdAt)}</Chip>
                </div>
                {/* Their promo codes (bookings with them count as theirs), and a quick way to give one. */}
                <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-canvas px-3 py-2">
                  <span className="text-[12px] font-semibold text-muted">{tP("promoCodesLabel")}</span>
                  {p.promoCodes.length === 0 && <span className="text-[12px] text-muted">{tP("noPromoCodes")}</span>}
                  {p.promoCodes.map((c) => (
                    <span key={c.id} className={cn("rounded-md border border-dashed px-2 py-0.5 font-mono text-[12px] font-bold", c.active ? "border-primary/40 text-primary" : "border-line-strong text-muted line-through")}>
                      {c.code}
                    </span>
                  ))}
                  {p.status === "ACTIVE" && (
                    <Link href={{ pathname: "/admin/promotions", query: { for: p.id } }} className="ml-auto text-[12px] font-semibold text-primary hover:underline">
                      + {tP("givePromoCode")}
                    </Link>
                  )}
                </div>
                {p.about && <p className="rounded-xl bg-canvas px-3 py-2 text-[13px] text-ink">{p.about}</p>}
                {p.payoutNumber && (
                  <p className="text-[13px] text-muted">
                    {tP("payTo")}: {p.payoutMethod === "BANK" ? `${p.bankName ?? ""} ` : ""}
                    {p.payoutName ?? ""} {maskAccount(p.payoutNumber)}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <EditPromoter
                    promoterId={p.id}
                    initial={{ about: p.about, payoutMethod: p.payoutMethod ?? "MOBILE_MONEY", payoutName: p.payoutName ?? "", payoutNumber: p.payoutNumber ?? "", bankName: p.bankName }}
                  />
                  <PromoterStatusButtons promoterId={p.id} status={p.status} />
                  {p._count.rewards === 0 && (
                    <ConfirmAction label={tP("delete")} question={tP("deleteQuestion")} action={deletePromoterAction.bind(null, p.id)} errors={{ hasRewards: tP("staffError.hasRewards") }} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
