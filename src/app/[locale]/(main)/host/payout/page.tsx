import { BadgeCheck, Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { HostTabs } from "@/features/hosting/components/HostTabs";
import { PageContainer } from "@/components/ui/PageContainer";
import { Card } from "@/features/hosting/components/fields";
import { PayoutForm } from "@/features/places/components/PayoutForm";
import { payoutAccountOf } from "@/features/places/payout-service";
import { requireUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getTranslations("Places");
  return { title: t("payoutTitle") };
}

/** Where an owner gets paid. Staff verify it before the owner's places can go live. */
export default async function PayoutPage() {
  const user = await requireUser("/host/payout");
  const [t, account] = await Promise.all([getTranslations("Places"), payoutAccountOf(user.id)]);
  return (
    <PageContainer className="max-w-xl py-6 max-md:pt-2 md:py-10">
      <div className="mb-5">
        <HostTabs on="payout" />
      </div>
      <h1 className="mb-2 text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{t("payoutTitle")}</h1>
      <p className="mb-5 text-[15px] text-muted">{t("payoutIntro")}</p>
      {account && (
        <p
          className={
            account.verifiedAt
              ? "mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-[13px] font-semibold text-emerald-800"
              : "mb-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-[13px] font-semibold text-amber-900"
          }
        >
          {account.verifiedAt ? <BadgeCheck className="size-4" aria-hidden="true" /> : <Clock className="size-4" aria-hidden="true" />}
          {account.verifiedAt ? t("payoutVerified") : t("payoutPending")}
        </p>
      )}
      <Card title={t("payoutDetails")}>
        <PayoutForm
          initial={account && { method: account.method, accountName: account.accountName, accountNumber: account.accountNumber, bankName: account.bankName }}
        />
      </Card>
    </PageContainer>
  );
}
