import { getLocale, getTranslations } from "next-intl/server";
import { ConfirmAction } from "@/features/admin/components/ConfirmAction";
import { adminCard, Chip } from "@/features/admin/components/kit";
import { Panel, Table, td } from "@/features/admin/components/ui";
import { deletePromoterAction } from "@/features/promoters/actions";
import { AddPromoter, EditPromoter } from "@/features/promoters/components/StaffPromoterForm";
import { ApprovePromoter } from "@/features/promoters/components/ApprovePromoter";
import { GivePromoCode } from "@/features/promoters/components/GivePromoCode";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { PromoterRewardButtons, PromoterStatusButtons } from "@/features/promoters/components/StaffPromoterButtons";
import { allPromoters, openPromoterRewards } from "@/features/promoters/service";
import { maskAccount } from "@/features/places/payout-service";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { promoState, promoterMoney } from "@/features/promotions/discount";

const STATUS_TONE = { ACTIVE: "bg-emerald-100 text-emerald-800", PENDING: "bg-amber-100 text-amber-900", SUSPENDED: "bg-red-50 text-red-700", ENDED: "bg-canvas text-ink/70" } as const;
const iso = (d: Date) => new Date(d.getTime() + 2 * 3_600_000).toISOString().slice(0, 10);

/** Promoters (approve, suspend) and their rewards (approve, mark paid). Reward rules are in Settings. */
export async function PromotersView() {
  const now = new Date();
  const [t, tP, tPromo, locale, promoters, rewards] = await Promise.all([getTranslations("Admin"), getTranslations("Promoters"), getTranslations("Promotions"), getLocale(), allPromoters(now), openPromoterRewards()]);
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Africa/Kigali" });
  const rwf = (n: number) => formatRWF(n, locale);
  const empty = <p className="py-8 text-center text-[14px] text-muted">{t("nothingHere")}</p>;
  // People who asked to become promoters, waiting for VIIPA (shown first).
  const applications = promoters.filter((p) => p.status === "PENDING");
  // Running ones first, ended ones last.
  const team = promoters.filter((p) => p.status !== "PENDING").sort((a, b) => Number(a.status === "ENDED") - Number(b.status === "ENDED"));
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
            {team.map((p) => {
              const money = promoterMoney(p.rewards);
              return (
              <li key={p.id} className={cn(adminCard, p.status === "ENDED" && "opacity-80")}>
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <Link href={`/admin/users/${p.user.id}`} className="block truncate text-[16px] font-bold text-ink hover:text-primary">
                      {p.user.name}
                    </Link>
                    <span className="block truncate text-[12px] text-muted">{p.user.email}</span>
                  </span>
                  <Chip tone={STATUS_TONE[p.status]}>{tP(`status.${p.status}`)}</Chip>
                </div>
                {/* Their period: after the end date they are ended (codes stop) and can apply again. */}
                <p className="text-[13px] text-ink">
                  {p.startsAt && p.endsAt ? tP("periodLine", { from: day.format(p.startsAt), until: day.format(p.endsAt) }) : tP("noPeriod")}
                  {p.status === "ENDED" && <span className="block text-[12px] text-muted">{tP("endedNote")}</span>}
                </p>
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
                  {/* Each code with where it is now: active, or ended (off, past its date, used up). */}
                  {p.promoCodes.map((c) => {
                    const state = promoState(c, now);
                    const live = state === "active";
                    return (
                      <Link
                        key={c.id}
                        href={`/admin/promotions/codes/${c.id}`}
                        className={cn("inline-flex items-center gap-1.5 rounded-md border border-dashed px-2 py-0.5 text-[12px] hover:border-primary", live ? "border-primary/40 text-primary" : "border-line-strong text-muted")}
                      >
                        <b className={cn("font-mono font-bold", !live && state !== "scheduled" && "line-through")}>{c.code}</b>
                        <span className="font-semibold">{tPromo(`state.${state}`)}</span>
                      </Link>
                    );
                  })}
                  {p.status === "ACTIVE" && <GivePromoCode promoterId={p.id} />}
                </div>
                {/* The money they made, and where it stands; See who used it has every booking and the approve / pay buttons. */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-emerald-50/60 px-3 py-2 text-[12.5px]">
                  <span>
                    {tP("money.made")} <b className="font-bold text-emerald-800 tabular-nums">{rwf(money.made)}</b>
                  </span>
                  {money.toApprove > 0 && (
                    <span>
                      {tP("money.toApprove")} <b className="font-bold text-amber-800 tabular-nums">{rwf(money.toApprove)}</b>
                    </span>
                  )}
                  {money.toPay > 0 && (
                    <span>
                      {tP("money.toPay")} <b className="font-bold text-ink tabular-nums">{rwf(money.toPay)}</b>
                    </span>
                  )}
                  <span>
                    {tP("money.paid")} <b className="font-bold text-ink tabular-nums">{rwf(money.paid)}</b>
                  </span>
                </div>
                {p.about && <p className="rounded-xl bg-canvas px-3 py-2 text-[13px] text-ink">{p.about}</p>}
                {p.payoutNumber && (
                  <p className="text-[13px] text-muted">
                    {tP("payTo")}: {p.payoutMethod === "BANK" ? `${p.bankName ?? ""} ` : ""}
                    {p.payoutName ?? ""} {maskAccount(p.payoutNumber)}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <Link href={`/admin/promotions/promoters/${p.id}`} className="rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-primary-hover">
                    {tPromo("seeWhoUsed")}
                  </Link>
                  <EditPromoter
                    promoterId={p.id}
                    initial={{ about: p.about, payoutMethod: p.payoutMethod ?? "MOBILE_MONEY", payoutName: p.payoutName ?? "", payoutNumber: p.payoutNumber ?? "", bankName: p.bankName }}
                    period={p.status !== "ENDED" && p.startsAt && p.endsAt ? { startsOn: iso(p.startsAt), endsOn: iso(p.endsAt) } : p.status !== "ENDED" ? { startsOn: "", endsOn: "" } : null}
                  />
                  {p.status !== "ENDED" && <PromoterStatusButtons promoterId={p.id} status={p.status} />}
                  {p._count.rewards === 0 && (
                    <ConfirmAction label={tP("delete")} question={tP("deleteQuestion")} action={deletePromoterAction.bind(null, p.id)} errors={{ hasRewards: tP("staffError.hasRewards") }} />
                  )}
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
