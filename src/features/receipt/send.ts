import "server-only";
import { createTranslator } from "next-intl";
import { catalogs } from "@/i18n/messages";
import { toAppLocale } from "@/i18n/routing";
import { audit } from "@/features/audit/service";
import { receiptMarker } from "@/features/chats/receipt-marker";
import { notify } from "@/features/notifications/service";
import { db } from "@/lib/db";
import { formatRWF } from "@/lib/format";
import { canStaff } from "@/lib/roles";

export type SendReceiptResult =
  | { ok: true; conversationId: string }
  | { ok: false; error: "notAllowed" | "notFound" };

/**
 * Staff send a paid booking's receipt into the client's chat with VIIPA about that place (opened if needed):
 * a short message with the PDF to download. The client is told. Logged.
 */
export async function sendReceiptToChat(
  actor: {
    id: string;
    role?: string | null;
    staffAreas?: readonly string[] | null;
  },
  paymentId: string,
  now = new Date(),
): Promise<SendReceiptResult> {
  if (!canStaff(actor, "money")) return { ok: false, error: "notAllowed" };
  const payment = await db.payment.findFirst({
    where: { id: paymentId, status: "SUCCEEDED" },
    select: {
      amount: true,
      booking: {
        select: {
          reference: true,
          guestId: true,
          listingId: true,
          guest: { select: { locale: true } },
          listing: { select: { hostId: true, title: true } },
        },
      },
    },
  });
  if (!payment) return { ok: false, error: "notFound" };
  const b = payment.booking;
  const locale = toAppLocale(b.guest.locale);
  const t = createTranslator({
    locale,
    messages: catalogs[locale],
    namespace: "Money.receipt",
  });
  const body = `${t("chatText", { reference: b.reference, amount: formatRWF(payment.amount, locale) })}\n${receiptMarker(paymentId)}`;
  const conversationId = await db.$transaction(async (tx) => {
    const c = await tx.conversation.upsert({
      where: {
        listingId_guestId: { listingId: b.listingId, guestId: b.guestId },
      },
      create: {
        listingId: b.listingId,
        guestId: b.guestId,
        hostId: b.listing.hostId,
        lastMessageAt: now,
        hostReadAt: now,
      },
      update: { lastMessageAt: now, hostReadAt: now },
      select: { id: true },
    });
    await tx.message.create({
      data: { conversationId: c.id, senderId: actor.id, body, createdAt: now },
    });
    await notify(
      tx,
      b.guestId,
      "newMessage",
      { name: "VIIPA", title: b.listing.title },
      `/chats/${c.id}`,
    );
    await audit(tx, {
      actorId: actor.id,
      action: "receipt.sent",
      entityType: "booking",
      entityId: b.reference,
      data: { paymentId },
    });
    return c.id;
  });
  return { ok: true, conversationId };
}
