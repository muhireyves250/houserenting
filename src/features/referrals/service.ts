import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/features/audit/service";
import { newReference } from "@/features/bookings/reference";
import { notify, notifyAdmins } from "@/features/notifications/service";
import { db } from "@/lib/db";

export { REFERRAL_COOKIE } from "./cookie";
/** Only new accounts can be credited to an inviter (no claiming years later). */
const CLAIM_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const CODE = /^R-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

export const isReferralCode = (value: string) => CODE.test(value);

/** The person's own invite code, made the first time it is needed. */
export async function ensureReferralCode(userId: string): Promise<string> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (user?.referralCode) return user.referralCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newReference("R");
    try {
      const { count } = await db.user.updateMany({ where: { id: userId, referralCode: null }, data: { referralCode: code } });
      if (count === 1) return code;
      const again = await db.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
      if (again?.referralCode) return again.referralCode;
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }
  throw new Error("Could not create a referral code");
}

/** Credits a new account to whoever invited it: once, never to themselves, only within a few days of signing up. */
export async function claimReferral(userId: string, code: string, now: Date = new Date()): Promise<boolean> {
  if (!isReferralCode(code)) return false;
  return db.$transaction(async (tx) => {
    const [user, inviter] = await Promise.all([
      tx.user.findUnique({ where: { id: userId }, select: { referredById: true, createdAt: true } }),
      tx.user.findUnique({ where: { referralCode: code }, select: { id: true } }),
    ]);
    if (!user || !inviter || inviter.id === userId || user.referredById) return false;
    if (now.getTime() - user.createdAt.getTime() > CLAIM_WINDOW_MS) return false;
    const { count } = await tx.user.updateMany({ where: { id: userId, referredById: null }, data: { referredById: inviter.id } });
    if (count === 1) await audit(tx, { actorId: userId, action: "referral.claim", entityType: "user", entityId: userId, data: { inviter: inviter.id } });
    return count === 1;
  });
}

/**
 * After a guest's first finished stay: if referrals pay a reward, one reward waits for staff approval.
 * Cancelled or unpaid bookings never count (only COMPLETED ones reach here).
 */
export async function maybeCreateReward(tx: Prisma.TransactionClient, bookingId: string): Promise<void> {
  const config = await tx.platformConfig.findUnique({ where: { id: 1 }, select: { referralEnabled: true, referralRewardAmount: true } });
  if (!config?.referralEnabled || !config.referralRewardAmount) return;
  const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: { guestId: true, guest: { select: { referredById: true } } } });
  const referrerId = booking?.guest.referredById;
  if (!booking || !referrerId) return;
  const earlier = await tx.booking.count({ where: { guestId: booking.guestId, status: "COMPLETED", id: { not: bookingId } } });
  if (earlier > 0) return;
  const exists = await tx.referralReward.findUnique({ where: { refereeId: booking.guestId }, select: { id: true } });
  if (exists) return;
  await tx.referralReward.create({ data: { referrerId, refereeId: booking.guestId, bookingId, amount: config.referralRewardAmount } });
  await notifyAdmins(tx, "rewardToCheck", {}, "/admin/money");
}

export function pendingRewards() {
  return db.referralReward.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: { id: true, amount: true, createdAt: true, referrer: { select: { name: true, email: true } }, referee: { select: { name: true } }, booking: { select: { reference: true } } },
  });
}

export async function decideReward(adminId: string, id: string, approve: boolean, now: Date = new Date()): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const reward = await tx.referralReward.findFirst({ where: { id, status: "PENDING" } });
    if (!reward) return false;
    await tx.referralReward.update({ where: { id }, data: { status: approve ? "APPROVED" : "VOID", decidedAt: now } });
    if (approve) {
      await tx.ledgerEntry.create({ data: { kind: "REFERRAL_REWARD", amount: reward.amount, bookingId: reward.bookingId, note: `referrer ${reward.referrerId}` } });
      await notify(tx, reward.referrerId, "rewardApproved", { amount: reward.amount }, "/profile");
    }
    await audit(tx, { actorId: adminId, action: approve ? "reward.approve" : "reward.void", entityType: "reward", entityId: id });
    return true;
  });
}

/** How many friends someone invited, and their rewards. */
export async function referralSummary(userId: string) {
  const [invited, rewards] = await Promise.all([
    db.user.count({ where: { referredById: userId } }),
    db.referralReward.findMany({ where: { referrerId: userId }, select: { amount: true, status: true } }),
  ]);
  return {
    invited,
    approved: rewards.filter((r) => r.status === "APPROVED").reduce((sum, r) => sum + r.amount, 0),
    pending: rewards.filter((r) => r.status === "PENDING").reduce((sum, r) => sum + r.amount, 0),
  };
}
