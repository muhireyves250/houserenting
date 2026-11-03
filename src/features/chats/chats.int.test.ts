import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { listConversations, openConversation, sendMessage, startConversation, unreadChats } from "./service";

beforeEach(async () => {
  await resetDb();
  await db.listing.deleteMany();
  await db.user.createMany({
    data: [
      { id: "host", name: "Aline Host", email: "host@example.com" },
      { id: "guest", name: "Eric Guest", email: "guest@example.com" },
      { id: "other", name: "Other", email: "other@example.com" },
      { id: "staff", name: "Staff", email: "staff@example.com", role: "ADMIN" },
    ],
  });
  await db.listing.create({
    data: {
      id: "flat",
      hostId: "host",
      title: "City flat",
      description: "Nice",
      type: "APARTMENT",
      status: "PUBLISHED",
      addressLine: "KG 1",
      district: "Gasabo",
      city: "Kigali",
      lat: -1.95,
      lng: 30.06,
      sizeM2: 60,
      rooms: 3,
      bedrooms: 2,
      bathrooms: 1,
      maxGuests: 4,
      rates: { create: [{ unit: "NIGHT", price: 50000 }] },
    },
  });
});

describe("chats between a client and VIIPA", () => {
  it("clients write to VIIPA; staff answer; the owner isn't part of it", async () => {
    const guest = { id: "guest" };
    const host = { id: "host" };
    const staff = { id: "staff", role: "ADMIN" };
    const started = await startConversation("guest", "flat");
    expect(started.ok).toBe(true);
    const id = started.ok ? started.id : "";
    expect(await startConversation("guest", "flat")).toEqual({ ok: true, id });
    expect(await startConversation("host", "flat")).toEqual({ ok: false, error: "ownListing" });

    expect(await sendMessage(guest, id, "  Hello, is parking included?  ")).toBe(true);
    expect(await sendMessage({ id: "other" }, id, "I'm not in this chat")).toBe(false);
    expect(await sendMessage(host, id, "The owner can't answer here")).toBe(false);
    expect(await sendMessage(guest, id, "   ")).toBe(false);

    // The client sees VIIPA on the other side; staff see it as unread; the owner sees nothing.
    expect(await listConversations(guest)).toEqual([expect.objectContaining({ id, role: "guest", unread: false, other: expect.objectContaining({ name: "VIIPA" }), last: expect.objectContaining({ body: "Hello, is parking included?" }) })]);
    expect(await listConversations(staff)).toEqual([expect.objectContaining({ id, role: "staff", unread: true })]);
    expect(await listConversations(host)).toEqual([]);
    expect(await unreadChats(staff)).toBe(1);
    expect(await db.notification.findFirst({ where: { userId: "staff", kind: "newMessage" } })).toMatchObject({ href: `/admin/messages/${id}` });

    // Opening marks it read for staff; their reply reaches the client as VIIPA.
    expect((await openConversation(staff, id))?.messages).toHaveLength(1);
    expect(await unreadChats(staff)).toBe(0);
    expect(await sendMessage(staff, id, "Yes, one car.")).toBe(true);
    expect(await unreadChats(guest)).toBe(1);
    expect((await openConversation(guest, id))?.messages.at(-1)).toMatchObject({ mine: false, body: "Yes, one car." });
    expect(await openConversation(host, id)).toBeNull();
    expect(await openConversation({ id: "other" }, id)).toBeNull();
  });
});
