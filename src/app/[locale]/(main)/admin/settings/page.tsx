import { SettingsForm } from "@/features/settings/components/SettingsForm";
import { getSettings } from "@/features/settings/service";
import { fromBps } from "@/features/settings/validation";
import { getEnv } from "@/lib/env";
import { requireAdmin } from "@/lib/permissions";

export default async function AdminSettingsPage() {
  await requireAdmin("/admin/settings");
  const settings = await getSettings();
  return (
    <SettingsForm
      envHoldMinutes={getEnv().BOOKING_HOLD_MINUTES}
      initial={{
        commissionPercent: fromBps(settings.commissionBps),
        guestFeePercent: fromBps(settings.guestFeeBps),
        holdMinutes: settings.holdMinutes,
        monthlyDepositPercent: settings.monthlyDepositPercent,
        monthlyUpfrontMonths: settings.monthlyUpfrontMonths,
        monthlyIdentity: settings.monthlyIdentity,
        referralEnabled: settings.referralEnabled,
        referralRewardAmount: settings.referralRewardAmount,
        cancellationPolicy: settings.cancellationPolicy,
      }}
    />
  );
}
