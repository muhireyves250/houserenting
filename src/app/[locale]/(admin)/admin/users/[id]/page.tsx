import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/Avatar";
import { RoleToggle } from "@/features/admin/components/RoleToggle";
import { UserStatusForm } from "@/features/admin/components/StaffForms";
import { Facts, PageIntro, Panel, Table, td } from "@/features/admin/components/ui";
import { userForStaff } from "@/features/admin/queries";
import { recentAudit } from "@/features/audit/service";
import { StatusBadge } from "@/features/bookings/components/StatusBadge";
import { formatKigaliDateTime, formatStayDates } from "@/features/bookings/format";
import { HostStatus } from "@/features/hosting/components/HostStatus";
import { TicketStatusBadge } from "@/features/support/components/TicketStatusBadge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { dynamicMessage } from "@/lib/dynamic-message";
import { formatRWF } from "@/lib/format";
import { requireAdmin } from "@/lib/permissions";

type Props = { params: Promise<{ id: string }> };
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function AdminUserPage({ params }: Props) {
  const { id } = await params;
  const admin = await requireAdmin(`/admin/users/${id}`);
  const user = await userForStaff(id);
  if (!user) notFound();
  const [t, tBookings, tHost, tSupport, locale, history] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("Bookings"),
    getTranslations("Host"),
    getTranslations("Support"),
    getLocale(),
    recentAudit({ entityType: "user", entityId: id, take: 20 }),
  ]);
  const self = admin.id === user.id;
  const badge = "rounded-full px-2.5 py-0.5 text-xs font-semibold";

  return (
    <div>
      <PageIntro back={{ href: "/admin/users", label: t("nav.users") }} />
      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-5">
        <Avatar name={user.name} className="size-14 text-lg" />
        <div className="min-w-0 flex-1">
          <p className="text-[18px] font-bold text-ink">{user.name}</p>
          <p className="truncate text-[13px] text-muted">{user.email}</p>
        </div>
        <span className="flex flex-wrap gap-1.5">
          {user.role === "ADMIN" && <span className={cn(badge, "bg-primary/10 text-primary")}>{t("staff")}</span>}
          {user.isHost && <span className={cn(badge, "bg-canvas text-ink/80")}>{t("hostBadge")}</span>}
          <span className={cn(badge, user.status === "SUSPENDED" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800")}>{t(`userStatus.${user.status}`)}</span>
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <Panel title={t("theirBookings")} flush>
            <Table head={[t("col.reference"), t("col.place"), t("col.when"), t("col.total"), t("col.status")]} empty={user.bookings.length === 0 ? <p className="py-8 text-center text-[14px] text-muted">{t("nothingHere")}</p> : null}>
              {user.bookings.map((b) => (
                <tr key={b.reference} className="hover:bg-canvas/70">
                  <td className={td}>
                    <Link href={`/admin/bookings/${b.reference}`} className="font-mono text-[13px] font-semibold text-primary hover:underline">
                      {b.reference}
                    </Link>
                  </td>
                  <td className={`${td} max-w-[200px] truncate`}>{b.listing.title}</td>
                  <td className={`${td} whitespace-nowrap`}>{formatStayDates(locale, iso(b.checkIn), iso(b.checkOut))}</td>
                  <td className={`${td} whitespace-nowrap tabular-nums`}>{formatRWF(b.total, locale)}</td>
                  <td className={td}>
                    <StatusBadge status={b.status} label={tBookings(`status.${b.status}`)} />
                  </td>
                </tr>
              ))}
            </Table>
          </Panel>
          {user.listings.length > 0 && (
            <Panel title={t("theirListings")} flush>
              <ul className="divide-y divide-line">
                {user.listings.map((l) => (
                  <li key={l.id}>
                    <Link href={`/admin/listings/${l.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas/70">
                      <span className="min-w-0 truncate text-[14px] font-medium text-ink">{l.title}</span>
                      <HostStatus status={l.status} label={tHost(`status.${l.status}`)} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {user.tickets.length > 0 && (
            <Panel title={t("theirTickets")} flush>
              <ul className="divide-y divide-line">
                {user.tickets.map((tk) => (
                  <li key={tk.reference}>
                    <Link href={`/admin/support/${tk.reference}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas/70">
                      <span className="min-w-0 truncate text-[14px] text-ink">{tk.subject}</span>
                      <TicketStatusBadge status={tk.status} label={tSupport(`status.${tk.status}`)} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
        <div className="flex flex-col gap-5">
          <Panel title={t("account")}>
            <Facts
              rows={[
                { label: t("col.phone"), value: user.phone ?? "—" },
                { label: t("emailVerified"), value: user.emailVerified ? t("yes") : t("no") },
                { label: t("col.joined"), value: formatKigaliDateTime(locale, user.createdAt) },
                { label: t("language"), value: user.locale.toUpperCase() },
                { label: t("invitedBy"), value: user.referredBy ? <Link href={`/admin/users/${user.referredBy.id}`} className="text-primary hover:underline">{user.referredBy.name}</Link> : "—" },
                { label: t("invited"), value: user._count.referrals },
              ]}
            />
          </Panel>
          <Panel title={t("staffAccess")}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-muted">{user.role === "ADMIN" ? t("isStaff") : t("notStaff")}</span>
              <RoleToggle userId={user.id} role={user.role} self={self} />
            </div>
          </Panel>
          {!self && (
            <Panel title={user.status === "SUSPENDED" ? t("reactivate") : t("suspend")}>
              <UserStatusForm userId={user.id} status={user.status} />
            </Panel>
          )}
          <Panel title={t("history")} flush>
            {history.length === 0 ? (
              <p className="px-5 py-5 text-[14px] text-muted">{t("noAudit")}</p>
            ) : (
              <ol className="divide-y divide-line">
                {history.map((e) => (
                  <li key={e.id} className="px-5 py-2.5 text-[13px]">
                    <b className="font-semibold text-ink">{dynamicMessage(t, `action.${e.action}`, e.action)}</b> · {e.actor?.name ?? t("system")}
                    {(e.data as { reason?: string } | null)?.reason && <span className="block text-muted">{(e.data as { reason: string }).reason}</span>}
                    <span className="block text-xs text-muted">{formatKigaliDateTime(locale, e.createdAt)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
