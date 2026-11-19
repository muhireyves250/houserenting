import { getTranslations } from "next-intl/server";
import { AdminModal } from "@/features/admin/components/AdminModal";
import AdminNotificationsPage from "../../notifications/page";

/** Notices, opened from the bell: the same list, in a window over the current page. Opening one closes it. */
export default async function NotificationsModal() {
  const t = await getTranslations("Admin.nav");
  return (
    <AdminModal title={t("notifications")} size="sm">
      <AdminNotificationsPage />
    </AdminModal>
  );
}
