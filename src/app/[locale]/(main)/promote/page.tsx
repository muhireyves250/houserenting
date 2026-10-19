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
  const link = data ? `${getEnv().BETTER_AUTH_URL.replace(/\/$/, "")}/api/v1/p/${data.promoter.code}` : null;
  const qr = link && data?.promoter.status === "ACTIVE" ? await QRCode.toString(link, { type: "svg", margin: 1, color: { dark: "#0b1b33", light: "#ffffff" } }) : null;

  return (
    <PageContainer className="max-w-2xl py-6 md:py-10">
      <Link href="/profile" className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t("back")}
      </Link>
      <h1 className="mb-1 text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{t("title")}</h1>
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
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: t("visits30"), value: String(data.visits30) },
              { label: t("bookings"), value: String(data.bookings) },
              { label: t("pending"), value: formatRWF(data.pending + data.approved, locale) },
              { label: t("paid"), value: formatRWF(data.paid, locale) },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
                <span className="block text-[13px] text-muted">{s.label}</span>
                <span className="block text-[20px] font-semibold text-ink tabular-nums">{s.value}</span>
              </div>
            ))}
          </section>
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
