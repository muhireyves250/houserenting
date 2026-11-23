"use client";

import { Select } from "@/components/ui/Select";

import { Trash2, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { MemberField } from "@/features/admin/components/MemberField";
import { addRestaurantMemberAction, removeRestaurantMemberAction } from "../actions";
import type { RestaurantTeamRole } from "../service";

/** The owner adds a manager, kitchen staff or delivery people. */
export function RestaurantTeam({ restaurantId, members, staff = false, readOnly = false }: { restaurantId: string; staff?: boolean; readOnly?: boolean; members: { id: string; role: RestaurantTeamRole; user: { name: string; email: string; emailVerified?: boolean } }[] }) {
  const t = useTranslations("Food");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RestaurantTeamRole>("STAFF");
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(0);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      {members.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-ink">{m.user.name}</span>
                <span className="block truncate text-xs text-muted">
                  {t(`role.${m.role}`)} · {m.user.email}
                </span>
              </span>
              {!readOnly && (
              <button
                type="button"
                aria-label={t("removeMember", { name: m.user.name })}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await removeRestaurantMemberAction(m.id);
                    router.refresh();
                  })
                }
                className="flex size-8 items-center justify-center rounded-full text-danger hover:bg-danger/5"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const result = await addRestaurantMemberAction(restaurantId, email, role);
            if (result.ok) {
              setEmail("");
              setAdded((n) => n + 1);
              setError(null);
              router.refresh();
            } else setError(t(`teamError.${result.error}`));
          });
        }}
      >
        <MemberField staff={staff} value={email} onChange={setEmail} label={t("memberEmail")} resetKey={added} />
        <Select value={role} aria-label={t("memberRole")} onChange={(e) => setRole(e.target.value as RestaurantTeamRole)} className="rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px]">
          {(["MANAGER", "STAFF", "DELIVERY"] as const).map((r) => (
            <option key={r} value={r}>
              {t(`role.${r}`)}
            </option>
          ))}
        </Select>
        <button type="submit" disabled={pending} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
          <UserPlus className="size-4" aria-hidden="true" />
          {t("addMember")}
        </button>
      </form>
      <p className="text-xs text-muted">{t("rolesHint")}</p>
        </>
      )}
      {error && <p role="alert" className="text-[13px] font-medium text-danger">{error}</p>}
    </div>
  );
}
