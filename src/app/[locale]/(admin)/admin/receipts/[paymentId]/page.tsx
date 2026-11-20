import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatKigaliDateTime, formatStayDates } from "@/features/bookings/format";
import { ReceiptHeader } from "@/features/receipt/components/ReceiptForm";
import { getReceiptDetails } from "@/features/receipt/service";
import { PrintButton } from "@/features/reports/components/PrintButton";
import { roomLabel } from "@/features/rooms/links";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatRWF } from "@/lib/format";
import { requireStaff } from "@/lib/permissions";

type Props = { params: Promise<{ paymentId: string }> };
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * One transaction's receipt, for staff to download (print to PDF) or hand to the guest: the business details from
 * Money → Receipt, who paid for which stay, how much, how and when.
 */
export default async function PaymentReceiptPage({ params }: Props) {
  const { paymentId } = await params;
  await requireStaff("money", `/admin/receipts/${paymentId}`);
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { booking: { select: { reference: true, checkIn: true, checkOut: true, roomNumber: true, room: { select: { name: true } }, guest: { select: { name: true, email: true, phone: true } }, listing: { select: { title: true, city: true } } } } },
  });
  if (!payment) notFound();
  const [t, tMoney, tReceipt, tRooms, locale, details] = await Promise.all([
    getTranslations("Money.receipt"),
    getTranslations("Money"),
    getTranslations("Receipt"),
    getTranslations("Rooms"),
    getLocale(),
    getReceiptDetails(),
  ]);
  const b = payment.booking;
  const room = [b.room?.name, b.roomNumber && roomLabel(b.roomNumber, (number) => tRooms("roomNumber", { number }))].filter(Boolean).join(" · ");
  const rows: [string, string][] = [
    [t("receiptNo"), payment.id.slice(-8).toUpperCase()],
    [t("date"), formatKigaliDateTime(locale, payment.createdAt)],
    [t("guest"), [b.guest.name, b.guest.phone ?? b.guest.email].filter(Boolean).join(" · ")],
    [t("booking"), b.reference],
    [t("place"), [b.listing.title, room].filter(Boolean).join(" · ")],
    [t("stay"), formatStayDates(locale, iso(b.checkIn), iso(b.checkOut))],
    [t("method"), payment.provider === "manual" ? tMoney("byHand") : payment.provider],
    [t("transaction"), payment.providerReference ?? "—"],
    [t("status"), tMoney(`payStatus.${payment.status as "SUCCEEDED"}`)],
  ];

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div data-print-hide className="flex items-center justify-between gap-3">
        <Link href="/admin/money" className="text-[13px] font-semibold text-primary hover:underline">
          ← {tMoney("title")}
        </Link>
        <PrintButton label={t("download")} />
      </div>
      <article className="rounded-2xl border border-line bg-surface p-6 print:border-0 print:p-0">
        <ReceiptHeader details={details} tinLabel={tReceipt("tinShort")} />
        <h1 className="mt-5 border-y border-dashed border-line py-3 text-center text-[15px] font-bold tracking-wide text-ink uppercase">{t("title")}</h1>
        <dl className="mt-3 flex flex-col divide-y divide-line text-[13px]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex items-baseline justify-between border-t-2 border-ink pt-3">
          <span className="text-[14px] font-bold text-ink">{t("amount")}</span>
          <span className="text-[20px] font-bold text-ink tabular-nums">{formatRWF(payment.amount, locale)}</span>
        </div>
        {details.footer && <p className="mt-5 border-t border-dashed border-line pt-3 text-center text-[12px] text-muted">{details.footer}</p>}
      </article>
    </div>
  );
}
