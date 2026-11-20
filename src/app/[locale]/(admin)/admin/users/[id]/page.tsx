import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/Avatar";
import { RoleToggle } from "@/features/admin/components/RoleToggle";
import { StaffAreasForm } from "@/features/admin/components/StaffAreasForm";
import { UserActions } from "@/features/admin/components/UserActions";
import {
  Facts,
  PageIntro,
  Panel,
  Table,
  td,
} from "@/features/admin/components/ui";
import { userActivityForStaff, userForStaff } from "@/features/admin/queries";
import { StatTiles } from "@/features/admin/components/kit";
import { recentAudit } from "@/features/audit/service";
import { StatusBadge } from "@/features/bookings/components/StatusBadge";
import {
  formatKigaliDateTime,
  formatStayDates,
} from "@/features/bookings/format";
import { HostStatus } from "@/features/hosting/components/HostStatus";
import { TicketStatusBadge } from "@/features/support/components/TicketStatusBadge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { dynamicMessage } from "@/lib/dynamic-message";
import { formatRWF } from "@/lib/format";
import { requireStaff } from "@/lib/permissions";
import { canManageStaff } from "@/features/admin/service";

type Props = { params: Promise<{ id: string }> };
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** "Chrome on Android" from a browser's user agent (enough for staff to recognise a device). */
function device(ua: string | null): string {
  if (!ua) return "—";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
      ? "iPhone"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS/.test(ua)
          ? "Mac"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "";
  return [browser, os].filter(Boolean).join(" · ") || ua.slice(0, 40);
}

export default async function AdminUserPage({ params }: Props) {
  const { id } = await params;
  const admin = await requireStaff("settings", `/admin/users/${id}`);
  const user = await userForStaff(id);
  if (!user) notFound();
  const [
    t,
    u,
    tBookings,
    tHost,
    tSupport,
    tMoney,
    tFood,
    tLaundry,
    tPromoters,
    locale,
    history,
    more,
  ] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("Admin.userPage"),
    getTranslations("Bookings"),
    getTranslations("Host"),
    getTranslations("Support"),
    getTranslations("Money"),
    getTranslations("Food"),
    getTranslations("Laundry"),
    getTranslations("Promoters"),
    getLocale(),
    recentAudit({ entityType: "user", entityId: id, take: 20 }),
    userActivityForStaff(id),
  ]);
  const rwf = (n: number) => formatRWF(n, locale);
  const sum = (rs: { amount: number }[]) =>
    rs.reduce((n, r) => n + r.amount, 0);
  const promo = more.promoter;
  const promoEarned = promo
    ? sum(promo.rewards.filter((r) => r.status !== "VOID"))
    : 0;
  const promoWaiting = promo
    ? sum(
        promo.rewards.filter(
          (r) =>
            r.status === "PENDING" || (r.status === "APPROVED" && !r.paidAt),
        ),
      )
    : 0;
  const promoPaid = promo ? sum(promo.rewards.filter((r) => r.paidAt)) : 0;
  const row =
    "flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas/70";
  const sub = "block text-[12px] text-muted";
  const self = admin.id === user.id;
  const manageStaff = await canManageStaff(admin);
  const badge = "rounded-full px-2.5 py-0.5 text-xs font-semibold";

  return (
    <div>
      <PageIntro back={{ href: "/admin/users", label: t("nav.users") }} />
      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-5">
        <Avatar
          name={user.name}
          image={user.image}
          className="size-14 text-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[18px] font-bold text-ink">{user.name}</p>
          <p className="truncate text-[13px] text-muted">{user.email}</p>
        </div>
        <span className="flex flex-wrap gap-1.5">
          {user.role !== "USER" && (
            <span className={cn(badge, "bg-primary/10 text-primary")}>
              {t(`roleName.${user.role}`)}
            </span>
          )}
          {user.isHost && (
            <span className={cn(badge, "bg-canvas text-ink/80")}>
              {t("hostBadge")}
            </span>
          )}
          <span
            className={cn(
              badge,
              user.status === "SUSPENDED"
                ? "bg-red-50 text-red-800"
                : "bg-emerald-50 text-emerald-800",
            )}
          >
            {t(`userStatus.${user.status}`)}
          </span>
        </span>
      </div>
      <div className="mb-5">
        <StatTiles
          format={rwf}
          items={[
            {
              label: u("spent"),
              count: more.paidTotal,
              tone: "text-emerald-700",
            },
            {
              label: u("bookings"),
              count: more.counts?.bookings ?? 0,
              plain: true,
            },
            {
              label: u("orders"),
              count: more.counts?.foodOrders ?? 0,
              plain: true,
            },
            {
              label: u("favorites"),
              count: more.counts?.favorites ?? 0,
              plain: true,
            },
          ]}
        />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <Panel title={t("theirBookings")} flush>
            <Table
              head={[
                t("col.reference"),
                t("col.place"),
                t("col.when"),
                t("col.total"),
                t("col.status"),
              ]}
              empty={
                user.bookings.length === 0 ? (
                  <p className="py-8 text-center text-[14px] text-muted">
                    {t("nothingHere")}
                  </p>
                ) : null
              }
            >
              {user.bookings.map((b) => (
                <tr key={b.reference} className="hover:bg-canvas/70">
                  <td className={td}>
                    <Link
                      href={`/admin/bookings/${b.reference}`}
                      className="font-mono text-[13px] font-semibold text-primary hover:underline"
                    >
                      {b.reference}
                    </Link>
                  </td>
                  <td className={`${td} max-w-[200px] truncate`}>
                    {b.listing.title}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    {formatStayDates(locale, iso(b.checkIn), iso(b.checkOut))}
                  </td>
                  <td className={`${td} whitespace-nowrap tabular-nums`}>
                    {formatRWF(b.total, locale)}
                  </td>
                  <td className={td}>
                    <StatusBadge
                      status={b.status}
                      label={tBookings(`status.${b.status}`)}
                    />
                  </td>
                </tr>
              ))}
            </Table>
          </Panel>
          {more.payments.length > 0 && (
            <Panel title={u("payments")} flush>
              <ul className="divide-y divide-line">
                {more.payments.map((p) => (
                  <li key={p.id} className={row}>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-semibold tabular-nums text-ink">
                        {rwf(p.amount)}
                      </span>
                      <span className={sub}>
                        {p.booking.reference} · {p.provider} ·{" "}
                        {formatKigaliDateTime(locale, p.createdAt)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-[12px] font-semibold text-muted">
                        {tMoney(`payStatus.${p.status}`)}
                      </span>
                      {p.status === "SUCCEEDED" && (
                        <Link
                          href={`/admin/receipts/${p.id}`}
                          className="text-[13px] font-semibold text-primary hover:underline"
                        >
                          {u("receipt")}
                        </Link>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {more.foodOrders.length > 0 && (
            <Panel title={u("food")} flush>
              <ul className="divide-y divide-line">
                {more.foodOrders.map((o) => (
                  <li key={o.reference}>
                    <Link href="/admin/orders" className={row}>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium text-ink">
                          <span className="font-mono text-[13px]">
                            {o.reference}
                          </span>{" "}
                          · {o.restaurant.name}
                        </span>
                        <span className={sub}>
                          {rwf(o.total)} ·{" "}
                          {formatKigaliDateTime(locale, o.createdAt)}
                        </span>
                      </span>
                      <span className="shrink-0 text-[12px] font-semibold text-muted">
                        {tFood(`status.${o.status}`)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {more.laundry.length > 0 && (
            <Panel title={u("laundry")} flush>
              <ul className="divide-y divide-line">
                {more.laundry.map((l) => (
                  <li key={l.reference} className={row}>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-medium text-ink">
                        <span className="font-mono text-[13px]">
                          {l.reference}
                        </span>{" "}
                        · {l.listing.title}
                      </span>
                      <span className={sub}>
                        {l.amount != null ? `${rwf(l.amount)} · ` : ""}
                        {formatKigaliDateTime(locale, l.createdAt)}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px] font-semibold text-muted">
                      {tLaundry(`status.${l.status}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {more.reviews.length > 0 && (
            <Panel title={u("reviews")} flush>
              <ul className="divide-y divide-line">
                {more.reviews.map((r) => (
                  <li key={r.id} className="px-5 py-3">
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-[14px] font-medium text-ink">
                        {r.listing.title}
                      </span>
                      <span className="shrink-0 text-[13px] font-semibold text-amber-600">
                        {"★".repeat(r.rating)}
                      </span>
                    </span>
                    {r.comment && (
                      <span className="mt-1 line-clamp-2 block text-[13px] text-ink/80">
                        {r.comment}
                      </span>
                    )}
                    <span className={sub}>
                      {formatKigaliDateTime(locale, r.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {user.listings.length > 0 && (
            <Panel title={t("theirListings")} flush>
              <ul className="divide-y divide-line">
                {user.listings.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/admin/listings/${l.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas/70"
                    >
                      <span className="min-w-0 truncate text-[14px] font-medium text-ink">
                        {l.title}
                      </span>
                      <HostStatus
                        status={l.status}
                        label={tHost(`status.${l.status}`)}
                      />
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
                    <Link
                      href={`/admin/support/${tk.reference}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas/70"
                    >
                      <span className="min-w-0 truncate text-[14px] text-ink">
                        {tk.subject}
                      </span>
                      <TicketStatusBadge
                        status={tk.status}
                        label={tSupport(`status.${tk.status}`)}
                      />
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
                {
                  label: t("emailVerified"),
                  value: user.emailVerified ? t("yes") : t("no"),
                },
                {
                  label: t("col.joined"),
                  value: formatKigaliDateTime(locale, user.createdAt),
                },
                { label: t("language"), value: user.locale.toUpperCase() },
                {
                  label: t("invitedBy"),
                  value: user.referredBy ? (
                    <Link
                      href={`/admin/users/${user.referredBy.id}`}
                      className="text-primary hover:underline"
                    >
                      {user.referredBy.name}
                    </Link>
                  ) : (
                    "—"
                  ),
                },
                { label: t("invited"), value: user._count.referrals },
              ]}
            />
          </Panel>
          {promo && (
            <Panel
              title={u("promoter")}
              actions={
                <Link
                  href="/admin/promoters"
                  className="text-[13px] font-semibold text-primary hover:underline"
                >
                  {u("openPromoters")}
                </Link>
              }
            >
              <Facts
                rows={[
                  {
                    label: t("col.status"),
                    value: tPromoters(`status.${promo.status}`),
                  },
                  {
                    label: u("promoterCode"),
                    value: <span className="font-mono">{promo.code}</span>,
                  },
                  {
                    label: u("promoCodes"),
                    value: promo.promoCodes.length
                      ? promo.promoCodes
                          .map(
                            (c) =>
                              `${c.code} (${c.promoterBps ? u("share", { percent: c.promoterBps / 100 }) : u("noShare")})`,
                          )
                          .join(", ")
                      : "—",
                  },
                  { label: u("brought"), value: promo._count.bookings },
                  {
                    label: u("earned"),
                    value: (
                      <span className="text-emerald-700">
                        {rwf(promoEarned)}
                      </span>
                    ),
                  },
                  { label: u("waiting"), value: rwf(promoWaiting) },
                  { label: u("paidOut"), value: rwf(promoPaid) },
                ]}
              />
            </Panel>
          )}
          {(more.referrals.length > 0 || more.referralRewards.length > 0) && (
            <Panel title={u("referrals")}>
              {more.referrals.length > 0 && (
                <ul className="mb-2 flex flex-col gap-1.5">
                  {more.referrals.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 text-[13px]"
                    >
                      <Link
                        href={`/admin/users/${r.id}`}
                        className="truncate font-medium text-primary hover:underline"
                      >
                        {r.name}
                      </Link>
                      <span className="shrink-0 text-muted">
                        {formatKigaliDateTime(locale, r.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Facts
                rows={[
                  {
                    label: u("rewards"),
                    value: rwf(
                      sum(
                        more.referralRewards.filter((r) => r.status !== "VOID"),
                      ),
                    ),
                  },
                ]}
              />
            </Panel>
          )}
          {more.payout && (
            <Panel title={u("payout")}>
              <Facts
                rows={[
                  {
                    label: more.payout.method,
                    value: `${more.payout.accountName} · ${more.payout.accountNumber}${more.payout.bankName ? ` · ${more.payout.bankName}` : ""}`,
                  },
                  {
                    label: u("verified"),
                    value: more.payout.verifiedAt
                      ? formatKigaliDateTime(locale, more.payout.verifiedAt)
                      : u("notVerified"),
                  },
                ]}
              />
            </Panel>
          )}
          <Panel title={u("signIns")} flush>
            {more.sessions.length === 0 ? (
              <p className="px-5 py-4 text-[14px] text-muted">
                {u("noSignIns")}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {more.sessions.map((s) => (
                  <li key={s.id} className="px-5 py-2.5 text-[13px]">
                    <b className="font-semibold text-ink">
                      {device(s.userAgent)}
                    </b>
                    {s.ipAddress && (
                      <span className="text-muted"> · {s.ipAddress}</span>
                    )}
                    <span className={sub}>
                      {u("lastSeen")}:{" "}
                      {formatKigaliDateTime(locale, s.updatedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title={t("staffAccess")}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-muted">
                {t(`roleName.${user.role}`)}
              </span>
              <RoleToggle
                userId={user.id}
                role={user.role}
                self={self}
                canManage={manageStaff}
              />
            </div>
            {/* Which services this manager handles (admins and super admins manage everything; customers nothing). */}
            {user.role === "MANAGER" && !self && (
              <div className="mt-4 border-t border-line pt-4">
                <StaffAreasForm
                  userId={user.id}
                  initial={user.staffAreas}
                  canManage={manageStaff}
                />
              </div>
            )}
            {(user.role === "SUPER_ADMIN" || user.role === "ADMIN") && (
              <p className="mt-3 text-[13px] text-muted">
                {t(user.role === "ADMIN" ? "adminAll" : "superAdminAll")}
              </p>
            )}
          </Panel>
          {/* Password reset, suspend or reactivate, delete: each asks first. */}
          {!self && (
            <Panel title={t("userActions.title")}>
              <UserActions
                inline
                self={self}
                user={{ id: user.id, name: user.name, status: user.status }}
              />
            </Panel>
          )}
          <Panel title={t("history")} flush>
            {history.length === 0 ? (
              <p className="px-5 py-5 text-[14px] text-muted">{t("noAudit")}</p>
            ) : (
              <ol className="divide-y divide-line">
                {history.map((e) => (
                  <li key={e.id} className="px-5 py-2.5 text-[13px]">
                    <b className="font-semibold text-ink">
                      {dynamicMessage(t, `action.${e.action}`, e.action)}
                    </b>{" "}
                    · {e.actor?.name ?? t("system")}
                    {(e.data as { reason?: string } | null)?.reason && (
                      <span className="block text-muted">
                        {(e.data as { reason: string }).reason}
                      </span>
                    )}
                    <span className="block text-xs text-muted">
                      {formatKigaliDateTime(locale, e.createdAt)}
                    </span>
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
