import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { getReceiptDetails, saveReceiptDetails } from "./service";

beforeEach(async () => {
  await resetDb();
  await db.user.create({
    data: {
      id: "admin",
      name: "Admin",
      email: "admin@example.com",
      role: "ADMIN",
    },
  });
});

describe("receipt details", () => {
  it("only staff change them; empty fields are left off; a bad email is refused", async () => {
    const input = {
      businessName: "VIIPA Ltd",
      address: "KG 7 Ave, Kigali",
      phone: "+250 788 000 000",
      email: "hello@viipa.rw",
      tin: "123456789",
      footer: "Thank you!",
    };
    expect(await saveReceiptDetails({ id: "someone" }, input)).toEqual({
      ok: false,
      error: "notAllowed",
    });
    expect(
      await saveReceiptDetails(
        { id: "admin", role: "ADMIN" },
        { ...input, email: "not-an-email" },
      ),
    ).toMatchObject({ ok: false, errors: { email: "email" } });
    expect(
      await saveReceiptDetails(
        { id: "admin", role: "ADMIN" },
        { ...input, tin: "  " },
      ),
    ).toEqual({ ok: true });
    const row = await db.platformConfig.findUniqueOrThrow({ where: { id: 1 } });
    expect([
      row.receiptBusinessName,
      row.receiptTin,
      row.receiptFooter,
    ]).toEqual(["VIIPA Ltd", null, "Thank you!"]);
    expect((await getReceiptDetails()).email).toBe("hello@viipa.rw");
  });
});

describe("sending a payment's receipt to the client's chat", () => {
  it("only staff send it; the client gets a message with the PDF and is told", async () => {
    const { sendReceiptToChat } = await import("./send");
    const { paymentReceipt } = await import("./payment-receipt");
    const { receiptPdf } = await import("./pdf");
    const { splitReceipt } = await import("@/features/chats/receipt-marker");
    await db.user.createMany({
      data: [
        { id: "owner", name: "Owner", email: "owner@example.com" },
        {
          id: "guest",
          name: "Guest Person",
          email: "guest@example.com",
          locale: "fr",
        },
      ],
    });
    await db.listing.create({
      data: {
        id: "house",
        hostId: "owner",
        title: "House",
        description: "Nice",
        type: "PRIVATE_HOUSE",
        status: "PUBLISHED",
        addressLine: "KG 1",
        district: "Gasabo",
        city: "Kigali",
        lat: -1.95,
        lng: 30.06,
        sizeM2: 90,
        rooms: 3,
        bedrooms: 2,
        bathrooms: 1,
        maxGuests: 4,
      },
    });
    const booking = await db.booking.create({
      data: {
        reference: "SR-RCP234",
        listingId: "house",
        guestId: "guest",
        status: "CONFIRMED",
        checkIn: new Date("2026-11-01T00:00:00Z"),
        checkOut: new Date("2026-11-03T00:00:00Z"),
        startAt: new Date("2026-11-01T12:00:00Z"),
        endAt: new Date("2026-11-03T09:00:00Z"),
        nights: 2,
        guests: 2,
        nightlyPrice: 50_000,
        subtotal: 100_000,
        total: 100_000,
        commission: 10_000,
        hostPayout: 90_000,
        policySnapshot: {},
      },
    });
    const payment = await db.payment.create({
      data: {
        bookingId: booking.id,
        provider: "manual",
        providerReference: "MP-1",
        amount: 100_000,
        status: "SUCCEEDED",
      },
    });

    expect(await sendReceiptToChat({ id: "guest" }, payment.id)).toEqual({
      ok: false,
      error: "notAllowed",
    });
    const sent = await sendReceiptToChat(
      { id: "admin", role: "ADMIN" },
      payment.id,
    );
    expect(sent.ok).toBe(true);
    const messages = await db.message.findMany({
      where: { conversation: { guestId: "guest", listingId: "house" } },
    });
    expect(messages).toHaveLength(1);
    const { text, receiptId } = splitReceipt(messages[0]!.body);
    expect(receiptId).toBe(payment.id);
    expect(text).toContain("SR-RCP234");
    expect(await db.notification.count({ where: { userId: "guest" } })).toBe(1);

    const receipt = await paymentReceipt(payment.id, "fr");
    expect(receipt?.title).toBe("Reçu de paiement");
    const pdf = await receiptPdf(receipt!);
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
  });
});
