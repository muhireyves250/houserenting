import "server-only";
import { createTranslator } from "next-intl";
import { catalogs } from "@/i18n/messages";
import { toAppLocale } from "@/i18n/routing";
import {
  formatKigaliDateTime,
  formatStayDates,
} from "@/features/bookings/format";
import { roomLabel } from "@/features/rooms/links";
import { db } from "@/lib/db";
import { formatRWF } from "@/lib/format";
import { getReceiptDetails } from "./service";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** One payment's receipt, ready to show or print: the business details, the lines and the amount, in `locale`. */
export async function paymentReceipt(paymentId: string, lang: string) {
  const locale = toAppLocale(lang);
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: {
      booking: {
        select: {
          reference: true,
          guestId: true,
          listingId: true,
          checkIn: true,
          checkOut: true,
          roomNumber: true,
          room: { select: { name: true } },
          guest: { select: { name: true, email: true, phone: true } },
          listing: { select: { title: true, city: true } },
        },
      },
    },
  });
  if (!payment) return null;
  const messages = catalogs[locale];
  const t = createTranslator({ locale, messages, namespace: "Money.receipt" });
  const tMoney = createTranslator({ locale, messages, namespace: "Money" });
  const tReceipt = createTranslator({ locale, messages, namespace: "Receipt" });
  const tRooms = createTranslator({ locale, messages, namespace: "Rooms" });
  const details = await getReceiptDetails();
  const b = payment.booking;
  const room = [
    b.room?.name,
    b.roomNumber &&
      roomLabel(b.roomNumber, (number) => tRooms("roomNumber", { number })),
  ]
    .filter(Boolean)
    .join(" · ");
  const rows: [string, string][] = [
    [t("receiptNo"), payment.id.slice(-8).toUpperCase()],
    [t("date"), formatKigaliDateTime(locale, payment.createdAt)],
    [
      t("guest"),
      [b.guest.name, b.guest.phone ?? b.guest.email]
        .filter(Boolean)
        .join(" · "),
    ],
    [t("booking"), b.reference],
    [t("place"), [b.listing.title, room].filter(Boolean).join(" · ")],
    [t("stay"), formatStayDates(locale, iso(b.checkIn), iso(b.checkOut))],
    [
      t("method"),
      payment.provider === "manual" ? tMoney("byHand") : payment.provider,
    ],
    [t("transaction"), payment.providerReference ?? "—"],
    [t("status"), tMoney(`payStatus.${payment.status as "SUCCEEDED"}`)],
  ];
  const headerLines = [
    details.address,
    [details.phone, details.email].filter(Boolean).join(" · "),
    details.tin ? `${tReceipt("tinShort")} ${details.tin}` : null,
  ].filter((line): line is string => Boolean(line));
  return {
    payment,
    booking: b,
    details,
    title: t("title"),
    businessName: details.businessName || "VIIPA",
    headerLines,
    rows,
    amountLabel: t("amount"),
    amount: formatRWF(payment.amount, locale),
    footer: details.footer,
  };
}

export type PaymentReceipt = NonNullable<
  Awaited<ReturnType<typeof paymentReceipt>>
>;
