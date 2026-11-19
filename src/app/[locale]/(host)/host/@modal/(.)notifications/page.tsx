import { getTranslations } from "next-intl/server";
import { AdminModal } from "@/features/admin/components/AdminModal";
import HostNotificationsPage from "../../notifications/page";

/** Opened from the top bar: the same page, as a panel sliding in from the right over the current one. */
export default async function Modal() {
  const t = await getTranslations("Host.shell");
  return (
    <AdminModal title={t("notifications")} size="sm">
      <HostNotificationsPage />
    </AdminModal>
  );
}
