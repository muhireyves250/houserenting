import "server-only";
import { audit } from "@/features/audit/service";
import { notify } from "@/features/notifications/service";
import { db } from "@/lib/db";
import { canOn } from "./access";
import type { Actor } from "./status-service";

export const TEAM_ROLES = ["MANAGER", "RECEPTIONIST"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export function listTeam(listingId: string) {
  return db.placeMember.findMany({ where: { listingId }, orderBy: { createdAt: "asc" }, include: { user: { select: { name: true, email: true } } } });
}

export type TeamResult = { ok: true } | { ok: false; error: "notAllowed" | "noAccount" | "isOwner" | "invalid" };

/** The owner (or staff) adds someone with an account as manager or receptionist of the place, or changes their role. */
export async function addTeamMember(actor: Actor, listingId: string, email: string, role: TeamRole): Promise<TeamResult> {
  if (!TEAM_ROLES.includes(role) || typeof email !== "string" || email.length > 200) return { ok: false, error: "invalid" };
  if (!(await canOn(actor, listingId, "team"))) return { ok: false, error: "notAllowed" };
  const [user, listing] = await Promise.all([
    db.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } }),
    db.listing.findUnique({ where: { id: listingId }, select: { hostId: true, title: true } }),
  ]);
  if (!user) return { ok: false, error: "noAccount" };
  if (!listing || listing.hostId === user.id) return { ok: false, error: "isOwner" };
  await db.$transaction(async (tx) => {
    await tx.placeMember.upsert({
      where: { listingId_userId: { listingId, userId: user.id } },
      create: { listingId, userId: user.id, role, addedById: actor.id },
      update: { role },
    });
    await audit(tx, { actorId: actor.id, action: "team.add", entityType: "listing", entityId: listingId, data: { user: user.id, role } });
    await notify(tx, user.id, "teamAdded", { title: listing.title, roleLabel: role }, "/host/bookings");
  });
  return { ok: true };
}

export async function removeTeamMember(actor: Actor, memberId: string): Promise<boolean> {
  const member = await db.placeMember.findUnique({ where: { id: memberId }, select: { listingId: true, userId: true } });
  if (!member || !(await canOn(actor, member.listingId, "team"))) return false;
  await db.$transaction(async (tx) => {
    await tx.placeMember.delete({ where: { id: memberId } });
    await audit(tx, { actorId: actor.id, action: "team.remove", entityType: "listing", entityId: member.listingId, data: { user: member.userId } });
  });
  return true;
}
