import { getTranslations } from "next-intl/server";
import { AdminModal } from "@/features/admin/components/AdminModal";
import AdminAccountPage from "../../account/page";

/** Your account, opened from the top bar or the menu: the same page, in a window over the current one. */
export default async function AccountModal() {
  const t = await getTranslations("Admin.nav");
  return (
    <AdminModal title={t("account")} size="sm">
      <AdminAccountPage />
    </AdminModal>
  );
}
