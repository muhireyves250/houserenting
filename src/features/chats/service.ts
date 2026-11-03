import "server-only";
import { notify, notifyAdmins } from "@/features/notifications/service";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

export const MESSAGE_MAX = 2000;

type Actor = { id: string; role?: string | null };

export type StartResult = { ok: true; id: string } | { ok: false; error: "notFound" | "ownListing" };

/**
 * Opens the client's conversation with VIIPA about a place (one per client and place, reused). VIIPA stands between
 * clients and owners: staff answer every conversation; the place's owner doesn't take part.
 */
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
/** How clients see the other side of every conversation. */
const TEAM = { id: "viipa", name: "VIIPA", image: null } as const;

/** A client's own conversations, or (for staff) every client conversation; newest first. */
export async function listConversations(actor: Actor) {
  const staff = isAdmin(actor);
  const rows = await db.conversation.findMany({
    where: staff ? {} : { guestId: actor.id },
    orderBy: { lastMessageAt: "desc" },
    take: 200,
    select: {
      id: true,
      guestId: true,
      lastMessageAt: true,
      guestReadAt: true,
      hostReadAt: true,
      guest: PARTY,
      listing: { select: { id: true, title: true, photos: { select: { url: true }, orderBy: { position: "asc" }, take: 1 } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, senderId: true, createdAt: true } },
    },
  });
  return rows.map((c) => {
    // Staff use the conversation's second read marker; the client the first.
    const readAt = staff ? c.hostReadAt : c.guestReadAt;
    const last = c.messages[0] ?? null;
    const fromOtherSide = last ? (staff ? last.senderId === c.guestId : last.senderId !== c.guestId) : false;
    return {
      id: c.id,
      other: staff ? c.guest : TEAM,
      role: staff ? ("staff" as const) : ("guest" as const),
      listing: { id: c.listing.id, title: c.listing.title, photo: c.listing.photos[0]?.url ?? null },
      last,
      mine: Boolean(last && (staff ? last.senderId !== c.guestId : last.senderId === actor.id)),
      unread: Boolean(last && fromOtherSide && (!readAt || readAt < last.createdAt)),
    };
  });
}

export type ConversationSummary = Awaited<ReturnType<typeof listConversations>>[number];

/** How many chats have messages the person hasn't read. */
export async function unreadChats(actor: Actor): Promise<number> {
  return (await listConversations(actor)).filter((c) => c.unread).length;
}

/** A conversation for its client or for staff (null for anyone else); opening it marks it read. */
export async function openConversation(actor: Actor, id: string, now: Date = new Date()) {
  const staff = isAdmin(actor);
  const c = await db.conversation.findFirst({
    where: { id, ...(staff ? {} : { guestId: actor.id }) },
    select: {
      id: true,
      guestId: true,
      guest: PARTY,
      listing: { select: { id: true, title: true, city: true, photos: { select: { url: true }, orderBy: { position: "asc" }, take: 1 } } },
      messages: { orderBy: { createdAt: "asc" }, take: 300, select: { id: true, body: true, senderId: true, createdAt: true, sender: { select: { name: true } } } },
    },
  });
  if (!c) return null;
  await db.conversation.update({ where: { id }, data: staff ? { hostReadAt: now } : { guestReadAt: now } });
  return {
    ...c,
    role: staff ? ("staff" as const) : ("guest" as const),
    other: staff ? c.guest : TEAM,
    // Each message from the viewer's side ("mine"): the client's own, or any staff member's for staff.
    messages: c.messages.map((m) => ({ ...m, mine: staff ? m.senderId !== c.guestId : m.senderId === actor.id })),
  };
}

/** The client writes to VIIPA (all staff are told), or a staff member answers (the client is told). */
export async function sendMessage(actor: Actor, conversationId: string, text: string, now: Date = new Date()): Promise<boolean> {
  const body = text.trim();
  if (body.length < 1 || body.length > MESSAGE_MAX) return false;
  const staff = isAdmin(actor);
  return db.$transaction(async (tx) => {
    const c = await tx.conversation.findFirst({
      where: { id: conversationId, ...(staff ? {} : { guestId: actor.id }) },
      select: { guestId: true, listing: { select: { title: true } }, guest: { select: { name: true } } },
    });
    if (!c) return false;
    await tx.message.create({ data: { conversationId, senderId: actor.id, body } });
    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now, ...(staff ? { hostReadAt: now } : { guestReadAt: now }) } });
    if (staff) await notify(tx, c.guestId, "newMessage", { name: TEAM.name, title: c.listing.title }, `/chats/${conversationId}`);
    else await notifyAdmins(tx, "newMessage", { name: c.guest.name.split(" ")[0] ?? "", title: c.listing.title }, `/admin/messages/${conversationId}`);
    return true;
  });
}
