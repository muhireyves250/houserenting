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

describe("chats between a client and a host", () => {
  it("opens one chat per client and place, and both sides see the messages", async () => {
    const started = await startConversation("guest", "flat");
    expect(started.ok).toBe(true);
    const id = started.ok ? started.id : "";
    expect(await startConversation("guest", "flat")).toEqual({ ok: true, id });
    expect(await startConversation("host", "flat")).toEqual({ ok: false, error: "ownListing" });

    expect(await sendMessage("guest", id, "  Hello, is parking included?  ")).toBe(true);
    expect(await sendMessage("other", id, "I'm not in this chat")).toBe(false);
    expect(await sendMessage("guest", id, "   ")).toBe(false);

    // The client sees it in their chats; the host sees it as unread, about their place.
    const guestChats = await listConversations("guest");
    expect(guestChats).toEqual([expect.objectContaining({ id, role: "guest", unread: false, other: { id: "host", name: "Aline Host" }, last: expect.objectContaining({ body: "Hello, is parking included?" }) })]);
    expect(await listConversations("host")).toEqual([expect.objectContaining({ id, role: "host", unread: true })]);
    expect(await unreadChats("host")).toBe(1);
    expect(await db.notification.findFirst({ where: { userId: "host", kind: "newMessage" } })).toMatchObject({ href: `/chats/${id}` });

    // Opening the chat marks it read; the host's reply reaches the client.
    expect((await openConversation("host", id))?.messages).toHaveLength(1);
    expect(await unreadChats("host")).toBe(0);
    await sendMessage("host", id, "Yes, one car.");
    expect(await unreadChats("guest")).toBe(1);
    expect(await openConversation("other", id)).toBeNull();
  });
});
