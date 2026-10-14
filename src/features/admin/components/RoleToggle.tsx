"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { setUserRoleAction } from "../actions";

export function RoleToggle({ userId, role, self }: { userId: string; role: string; self: boolean }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [pending, start] = useTransition();
  if (self) return <span className="text-xs text-muted">{t("you")}</span>;
  const next = role === "ADMIN" ? "USER" : "ADMIN";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setUserRoleAction(userId, next);
          router.refresh();
        })
      }
      className="rounded-lg bg-canvas px-3 py-1.5 text-[13px] font-semibold text-ink transition-colors hover:bg-line/70 disabled:opacity-50"
    >
      {next === "ADMIN" ? t("makeAdmin") : t("removeAdmin")}
    </button>
  );
}
