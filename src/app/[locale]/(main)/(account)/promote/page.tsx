import { InviteFriends } from "@/features/referrals/components/InviteFriends";
import { ensureReferralCode, referralSummary } from "@/features/referrals/service";
import { PageHero } from "@/components/shell/PageHero";
import { ChevronLeft, Megaphone } from "lucide-react";
import QRCode from "qrcode";
import { getLocale, getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/ui/PageContainer";
import { Card } from "@/features/hosting/components/fields";
import { PromoterForm } from "@/features/promoters/components/PromoterForm";
import { promoterDashboard } from "@/features/promoters/service";
import { getSettings } from "@/features/settings/service";
import { Link } from "@/i18n/navigation";
import { getEnv } from "@/lib/env";
import { formatRWF } from "@/lib/format";
import { formatStayDates } from "@/features/bookings/format";
import { cn } from "@/lib/cn";
import { requireUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getTranslations("Promoters");
  return { title: t("title") };
}

/** Promoters: apply, get a personal QR code and link, follow visits, bookings and rewards, and say where to be paid. */
export default async function PromotePage() {
  const user = await requireUser("/promote");
  const [t, locale, data, settings] = await Promise.all([getTranslations("Promoters"), getLocale(), promoterDashboard(user.id), getSettings()]);
  const reward = settings.promoterRewardFixed ? formatRWF(settings.promoterRewardFixed, locale) : settings.promoterRewardBps ? `${settings.promoterRewardBps / 100}%` : null;
  // What a stay will earn them once finished (a fixed amount, or a share of the stay price).
  const expected = (subtotal: number) => settings.promoterRewardFixed ?? (settings.promoterRewardBps ? Math.round((subtotal * settings.promoterRewardBps) / 10_000) : 0);
  const link = data ? `${getEnv().BETTER_AUTH_URL.replace(/\/$/, "")}/api/v1/p/${data.promoter.code}` : null;
  // Invite friends (referral rewards) lives here too, next to promoting.
  const referral = settings.referralEnabled
    ? { code: await ensureReferralCode(user.id), summary: await referralSummary(user.id), reward: settings.referralRewardAmount }
    : null;
  // Money still to come: their confirmed stays that haven't finished yet.
  const earnsFor = (b: NonNullable<typeof data>["recent"][number]) =>
    b.promoCode?.promoterId === data?.promoter.id && b.promoCode?.promoterBps ? Math.round((b.subtotal * b.promoCode.promoterBps) / 10_000) : expected(b.subtotal);
  const coming = (data?.recent ?? []).filter((b) => !b.promoterReward && b.status !== "COMPLETED").reduce((n, b) => n + earnsFor(b), 0);
  const qr = link && data?.promoter.status === "ACTIVE" ? await QRCode.toString(link, { type: "svg", margin: 1, color: { dark: "#0b1b33", light: "#ffffff" } }) : null;
  // Any client can invite friends: their invite link as a QR code to scan too.
  // Invite links open the sign-up straight away (the code is remembered for 30 days).
  const inviteLink = referral ? `${getEnv().BETTER_AUTH_URL.replace(/\/$/, "")}/signup?ref=${referral.code}` : null;
  const inviteQr = inviteLink ? await QRCode.toString(inviteLink, { type: "svg", margin: 1, color: { dark: "#0b1b33", light: "#ffffff" } }) : null;

  return (
    <PageContainer className="max-w-2xl py-6 md:py-10 max-md:pt-0">
      <PageHero title={t("title")} icon={Megaphone} />
      <Link href="/profile" className="mb-3 max-md:hidden inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t("back")}
      </Link>
      <h1 className="max-md:hidden mb-1 text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{t("title")}</h1>
      {referral && (
        <div className="mb-6 [&>*:first-child]:mt-0">
          <InviteFriends
            link={inviteLink ?? ""}
            code={referral.code}
            invited={referral.summary.invited}
            earned={referral.summary.approved}
            reward={referral.reward}
          />
          {inviteQr && (
            <div className="mt-3 flex items-center gap-4 rounded-2xl bg-surface p-4 ring-1 ring-line">
              <div className="size-32 shrink-0 rounded-xl bg-white p-1.5 ring-1 ring-line [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: inviteQr }} />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-[15px] font-semibold text-ink">{t("inviteQrTitle")}</p>
                <p className="text-[13px] text-muted">{t("inviteQrHint")}</p>
                <p className="font-mono text-[13px] font-semibold text-primary">{referral.code}</p>
              </div>
            </div>
          )}
        </div>
      )}
      <p className="mb-5 text-[15px] text-muted">{settings.promoterEnabled ? (reward ? t("introReward", { reward }) : t("intro")) : t("notOpen")}</p>
      {!data ? (
        settings.promoterEnabled && (
          <Card title={t("applyTitle")}>
            <PromoterForm applying initial={{ about: "", payoutMethod: "MOBILE_MONEY", payoutName: user.name, payoutNumber: "", bankName: null }} />
          </Card>
        )
      ) : (
        <div className="flex flex-col gap-4">
          {data.promoter.status === "PENDING" && <p className="rounded-2xl bg-amber-50 px-5 py-3.5 text-sm text-amber-900">{t("pendingNote")}</p>}
          {data.promoter.status === "SUSPENDED" && <p className="rounded-2xl bg-red-50 px-5 py-3.5 text-sm text-red-900">{t("suspendedNote", { reason: data.promoter.statusReason ?? "" })}</p>}
          {qr && link && (
            <Card title={t("yourCode")}>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                <div className="size-44 shrink-0 rounded-2xl bg-white p-2 ring-1 ring-line [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />
                <div className="flex min-w-0 flex-col gap-2">
                  <p className="font-mono text-[15px] font-semibold text-ink">{data.promoter.code}</p>
                  <p className="text-[13px] break-all text-muted">{link}</p>
                  <p className="text-[13px] text-muted">{t("codeHint")}</p>
                </div>
              </div>
            </Card>
          )}
          {/* Promo codes VIIPA gave this promoter: guests who use one count as theirs. */}
          {data.promoter.status === "ACTIVE" && data.promoCodes.length > 0 && (
            <Card title={t("yourPromoCodes")}>
              <ul className="flex flex-col gap-2">
                {data.promoCodes.map((c) => (
                  <li key={c.code} className="flex items-center justify-between gap-3 rounded-xl bg-canvas px-4 py-3">
                    <span className="rounded-lg border-2 border-dashed border-primary/40 bg-primary/[0.06] px-3 py-1 font-mono text-[15px] font-bold text-primary">{c.code}</span>
                    <span className="text-right text-[13px] font-semibold text-ink">
                      {c.percentOff ? `${c.percentOff}%` : formatRWF(c.amountOff ?? 0, locale)} {t("off")}
                      {c.promoterBps ? <span className="block text-[12px] font-semibold text-emerald-700">{t("youEarnShare", { percent: c.promoterBps / 100 })}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[13px] text-muted">{t("promoCodesHint")}</p>
            </Card>
          )}
          {/* What they earn per stay, or that VIIPA hasn't set it yet. */}
          {/* Their codes with a share already tell them what they earn; otherwise the programme's rate (or that none is set). */}
          {data.promoter.status === "ACTIVE" && !data.promoCodes.some((c) => c.promoterBps) && (
            <p className={cn("rounded-2xl px-5 py-3.5 text-[14px]", reward ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900")}>
              {reward ? t("rateLine", { reward }) : t("noRateYet")}
            </p>
          )}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: t("visits30"), value: String(data.visits30) },
              { label: t("bookings"), value: String(data.bookings) },
              { label: t("coming"), value: formatRWF(coming, locale) },
              { label: t("pending"), value: formatRWF(data.pending + data.approved, locale) },
              { label: t("paid"), value: formatRWF(data.paid, locale) },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
                <span className="block text-[13px] text-muted">{s.label}</span>
                <span className="block text-[20px] font-semibold text-ink tabular-nums">{s.value}</span>
              </div>
            ))}
          </section>
          {/* The bookings they brought and what each earns them. */}
          {data.recent.length > 0 && (
            <Card title={t("yourBookings")}>
              <ul className="flex flex-col divide-y divide-line">
                {data.recent.map((b) => {
                  // Through their own promo code: the share set on it; otherwise the programme's reward.
                  const earns = b.promoterReward?.amount ?? (b.promoCode?.promoterId === data.promoter.id && b.promoCode.promoterBps ? Math.round((b.subtotal * b.promoCode.promoterBps) / 10_000) : expected(b.subtotal));
                  const state = b.promoterReward ? (b.promoterReward.paidAt ? "paid" : b.promoterReward.status === "VOID" ? "void" : "waiting") : b.status === "COMPLETED" ? "none" : "coming";
                  return (
                    <li key={b.reference} className="flex items-center justify-between gap-3 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold text-ink">{b.listing.title}</span>
                        <span className="block text-[12px] text-muted">
                          {formatStayDates(locale, b.checkIn.toISOString().slice(0, 10), b.checkOut.toISOString().slice(0, 10))}
                          {b.promoCode && ` · ${b.promoCode.code}`}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[14px] font-bold text-ink tabular-nums">{earns > 0 ? formatRWF(earns, locale) : "—"}</span>
                        <span className={cn("block text-[11.5px] font-semibold", state === "paid" ? "text-emerald-700" : state === "void" ? "text-red-700" : "text-muted")}>{t(`earnState.${state}`)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
          <Card title={t("payoutTitle")}>
            <PromoterForm
              applying={false}
              initial={{ about: data.promoter.about, payoutMethod: data.promoter.payoutMethod ?? "MOBILE_MONEY", payoutName: data.promoter.payoutName ?? "", payoutNumber: data.promoter.payoutNumber ?? "", bankName: data.promoter.bankName }}
            />
          </Card>
          <p className="inline-flex items-start gap-2 text-[13px] text-muted">
            <Megaphone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t("rules")}
          </p>
        </div>
      )}
    </PageContainer>
  );
}
