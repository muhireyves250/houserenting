import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

type Client = Prisma.TransactionClient | typeof db;

/** Kinds of notice; each has its own wording in messages ("Notifications.kind.<kind>"). */
export type NotificationKind =
  | "bookingHeld"
  | "bookingCancelled"
  | "bookingExpired"
  | "listingApproved"
  | "listingRejected"
  | "listingSubmitted"
  | "questionAsked"
  | "questionAnswered"
  | "questionToCheck"
  | "reviewSubmitted"
  | "reviewPublished"
  | "ticketOpened"
  | "ticketReply"
  | "ticketStatus"
  | "bookingConfirmed"
  | "newBooking"
  | "paymentFailed"
  | "paymentProblem"
  | "rewardApproved"
  | "rewardToCheck"
  | "payoutRecorded";

export async function notify(
  client: Client,
  userId: string,
  kind: NotificationKind,
  data: Record<string, string | number> = {},
  href: string | null = null,
): Promise<void> {
  await client.notification.create({ data: { userId, kind, data, href } });
}

/** Tells every admin (e.g. a listing waits for review). */
export async function notifyAdmins(client: Client, kind: NotificationKind, data: Record<string, string | number>, href: string | null) {
  const admins = await client.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length === 0) return;
  await client.notification.createMany({ data: admins.map((a) => ({ userId: a.id, kind, data, href })) });
}

export async function listNotifications(userId: string, take = 50) {
  return db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take });
}

export async function unreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function markAllRead(userId: string, now: Date = new Date()): Promise<void> {
  await db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: now } });
}
