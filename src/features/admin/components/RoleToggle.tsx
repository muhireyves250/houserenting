"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { setUserRoleAction } from "../actions";

type Role = "USER" | "ADMIN" | "SUPER_ADMIN";

/** Customer, VIIPA admin or super admin. Shown only to staff allowed to manage staff. */
export function RoleToggle({ userId, role, self, canManage }: { userId: string; role: string; self: boolean; canManage: boolean }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [pending, start] = useTransition();
  if (self) return <span className="text-xs text-muted">{t("you")}</span>;
  if (!canManage) return <span className="text-xs text-muted">{t("superAdminOnly")}</span>;
  return (
    <select
      aria-label={t("staffAccess")}
      value={role}
      disabled={pending}
      onChange={(e) =>
        start(async () => {
          await setUserRoleAction(userId, e.target.value as Role);
          router.refresh();
        })
      }
      className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink disabled:opacity-50"
    >
      <option value="USER">{t("roleName.USER")}</option>
      <option value="ADMIN">{t("roleName.ADMIN")}</option>
      <option value="SUPER_ADMIN">{t("roleName.SUPER_ADMIN")}</option>
    </select>
  );
}
