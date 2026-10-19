import { getLocale, getTranslations } from "next-intl/server";
import { PageIntro, Panel, Table, td } from "@/features/admin/components/ui";
import { formatKigaliDateTime, formatStayDates } from "@/features/bookings/format";
import { pendingRefunds, pendingStayRequests } from "@/features/stay/service";
import { Link } from "@/i18n/navigation";
import { formatRWF } from "@/lib/format";
import { requireAdmin } from "@/lib/permissions";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Guests' change and cancellation requests waiting for an answer, and refunds waiting to be sent. */
export default async function AdminRequestsPage() {
  await requireAdmin("/admin/requests");
  const [t, tStay, locale, requests, refunds] = await Promise.all([getTranslations("Admin"), getTranslations("MyStay"), getLocale(), pendingStayRequests(), pendingRefunds()]);
  const empty = <p className="py-8 text-center text-[14px] text-muted">{t("nothingHere")}</p>;
  return (
    <div className="flex flex-col gap-5">
      <PageIntro description={tStay("queueIntro")} />
      <Panel title={tStay("requestsTitle")} flush>
        <Table head={[t("col.reference"), t("col.guest"), t("col.place"), tStay("what"), t("col.when")]} empty={requests.length === 0 ? empty : null}>
          {requests.map((r) => (
            <tr key={r.id} className="hover:bg-canvas/70">
              <td className={td}>
                <Link href={`/admin/bookings/${r.booking.reference}`} className="font-mono text-[13px] font-semibold text-primary hover:underline">
                  {r.booking.reference}
                </Link>
              </td>
              <td className={td}>{r.booking.guest.name}</td>
              <td className={td}>
                {r.booking.listing.title}
                <span className="block text-xs text-muted">{formatStayDates(locale, iso(r.booking.checkIn), iso(r.booking.checkOut))}</span>
              </td>
              <td className={td}>
                <b className="font-semibold">{tStay(`kind.${r.kind}`)}</b>
                <span className="block max-w-xs truncate text-xs text-muted">{r.transferTo ?? r.reason}</span>
              </td>
              <td className={`${td} whitespace-nowrap`}>{formatKigaliDateTime(locale, r.createdAt)}</td>
            </tr>
          ))}
        </Table>
      </Panel>
      <Panel title={tStay("refundsTitle")} flush>
        <Table head={[t("col.reference"), t("col.guest"), t("col.place"), t("col.total")]} empty={refunds.length === 0 ? empty : null}>
          {refunds.map((b) => (
            <tr key={b.reference} className="hover:bg-canvas/70">
              <td className={td}>
                <Link href={`/admin/bookings/${b.reference}`} className="font-mono text-[13px] font-semibold text-primary hover:underline">
                  {b.reference}
                </Link>
              </td>
              <td className={td}>{b.guest.name}</td>
              <td className={td}>{b.listing.title}</td>
              <td className={`${td} whitespace-nowrap tabular-nums`}>{formatRWF(b.refundAmount ?? 0, locale)}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
