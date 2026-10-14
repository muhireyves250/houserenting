import { Search } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { RoleToggle } from "@/features/admin/components/RoleToggle";
import { findUsers } from "@/features/admin/service";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { requireAdmin } from "@/lib/permissions";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function AdminUsersPage({ searchParams }: Props) {
  const admin = await requireAdmin("/admin/users");
  const q = ((await searchParams).q ?? "").slice(0, 100);
  const [t, locale, users] = await Promise.all([getTranslations("Admin"), getLocale(), findUsers(q)]);
  return (
    <div className="flex flex-col gap-4">
      <form className="flex items-center gap-3 rounded-full border border-line-strong bg-surface px-4 py-2.5 focus-within:border-primary">
        <Search className="size-4 text-muted" aria-hidden="true" />
        <input name="q" defaultValue={q} placeholder={t("searchUsers")} aria-label={t("searchUsers")} className="w-full bg-transparent text-[15px] outline-none" />
      </form>
      <ul className="divide-y divide-line rounded-3xl bg-surface px-5 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line">
        {users.map((user) => (
          <li key={user.id} className="flex items-center justify-between gap-4 py-3">
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold text-ink">
                {user.name}
                {user.role === "ADMIN" && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{t("staff")}</span>}
                {user.isHost && <span className="ml-2 rounded-full bg-canvas px-2 py-0.5 text-xs text-ink/80">{t("hostBadge")}</span>}
              </span>
              <span className="block truncate text-[13px] text-muted">
                {user.email} · {formatKigaliDateTime(locale, user.createdAt)}
              </span>
            </span>
            <RoleToggle userId={user.id} role={user.role} self={user.id === admin.id} />
          </li>
        ))}
      </ul>
    </div>
  );
}
