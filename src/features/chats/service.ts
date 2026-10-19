import "server-only";
import { notify } from "@/features/notifications/service";
import { db } from "@/lib/db";

export const MESSAGE_MAX = 2000;

export type StartResult = { ok: true; id: string } | { ok: false; error: "notFound" | "ownListing" };

/** Opens the guest's conversation with the host about a place (one per guest and place, reused). */
export async function startConversation(guestId: string, listingId: string): Promise<StartResult> {
  const listing = await db.listing.findFirst({ where: { id: listingId, status: "PUBLISHED" }, select: { hostId: true } });
  if (!listing) return { ok: false, error: "notFound" };
  if (listing.hostId === guestId) return { ok: false, error: "ownListing" };
  const conversation = await db.conversation.upsert({
    where: { listingId_guestId: { listingId, guestId } },
    create: { listingId, guestId, hostId: listing.hostId },
    update: {},
    select: { id: true },
  });
  return { ok: true, id: conversation.id };
}

const PARTY = { select: { id: true, name: true, image: true } } as const;

/** Everyone's chats, newest first: as a guest and as a host. */
export async function listConversations(userId: string) {
  const rows = await db.conversation.findMany({
    where: { OR: [{ guestId: userId }, { hostId: userId }] },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    select: {
      id: true,
      guestId: true,
      lastMessageAt: true,
      guestReadAt: true,
      hostReadAt: true,
      guest: PARTY,
      host: PARTY,
      listing: { select: { id: true, title: true, photos: { select: { url: true }, orderBy: { position: "asc" }, take: 1 } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, senderId: true, createdAt: true } },
    },
  });
  return rows.map((c) => {
    const asGuest = c.guestId === userId;
    const readAt = asGuest ? c.guestReadAt : c.hostReadAt;
    const last = c.messages[0] ?? null;
    return {
      id: c.id,
      other: asGuest ? c.host : c.guest,
      role: asGuest ? ("guest" as const) : ("host" as const),
      listing: { id: c.listing.id, title: c.listing.title, photo: c.listing.photos[0]?.url ?? null },
      last,
      unread: Boolean(last && last.senderId !== userId && (!readAt || readAt < last.createdAt)),
    };
  });
}

export type ConversationSummary = Awaited<ReturnType<typeof listConversations>>[number];

/** How many chats have messages the person hasn't read. */
export async function unreadChats(userId: string): Promise<number> {
  return (await listConversations(userId)).filter((c) => c.unread).length;
}

/** A conversation for one of its two people (null for anyone else); opening it marks it read. */
export async function openConversation(userId: string, id: string, now: Date = new Date()) {
  const c = await db.conversation.findFirst({
    where: { id, OR: [{ guestId: userId }, { hostId: userId }] },
    select: {
      id: true,
      guestId: true,
      guest: PARTY,
      host: PARTY,
      listing: { select: { id: true, title: true, city: true, photos: { select: { url: true }, orderBy: { position: "asc" }, take: 1 } } },
      messages: { orderBy: { createdAt: "asc" }, take: 300, select: { id: true, body: true, senderId: true, createdAt: true } },
    },
  });
  if (!c) return null;
  const asGuest = c.guestId === userId;
  await db.conversation.update({ where: { id }, data: asGuest ? { guestReadAt: now } : { hostReadAt: now } });
  return { ...c, role: asGuest ? ("guest" as const) : ("host" as const), other: asGuest ? c.host : c.guest };
}

/** Sends a message in a conversation the sender belongs to; the other person is notified. */
export async function sendMessage(userId: string, conversationId: string, text: string, now: Date = new Date()): Promise<boolean> {
  const body = text.trim();
  if (body.length < 1 || body.length > MESSAGE_MAX) return false;
  return db.$transaction(async (tx) => {
    const c = await tx.conversation.findFirst({
      where: { id: conversationId, OR: [{ guestId: userId }, { hostId: userId }] },
      select: { guestId: true, hostId: true, listing: { select: { title: true } }, guest: { select: { name: true } }, host: { select: { name: true } } },
    });
    if (!c) return false;
    const asGuest = c.guestId === userId;
    await tx.message.create({ data: { conversationId, senderId: userId, body } });
    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now, ...(asGuest ? { guestReadAt: now } : { hostReadAt: now }) } });
    await notify(tx, asGuest ? c.hostId : c.guestId, "newMessage", { name: (asGuest ? c.guest.name : c.host.name).split(" ")[0] ?? "", title: c.listing.title }, `/chats/${conversationId}`);
    return true;
  });
}
