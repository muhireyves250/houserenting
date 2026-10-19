"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LISTING_MOVES, type ListingMove } from "@/features/listings/lifecycle";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";
import { BLOCK_KINDS, createBlock, endBlock, type BlockKind, type BlockResult } from "./blocks-service";
import { deleteDocument } from "./documents-service";
import { savePayoutAccount, verifyPayoutAccount, type PayoutInput } from "./payout-service";
import { moveListing, updatePlaceAdmin, type MoveResult } from "./status-service";
import { addTeamMember, removeTeamMember, type TeamResult, type TeamRole } from "./team-service";

const id = z.string().min(1).max(64);
const refresh = () => revalidatePath("/[locale]", "layout");

export async function moveListingAction(listingId: string, move: ListingMove, reason: string): Promise<MoveResult | { ok: false; error: "auth" }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (!id.safeParse(listingId).success || !(move in LISTING_MOVES) || typeof reason !== "string" || reason.length > 500) return { ok: false, error: "notAllowed" };
  const result = await moveListing(user, listingId, move, reason);
  if (result.ok) refresh();
  return result;
}

export async function updatePlaceAdminAction(listingId: string, input: { contractStart: string | null; contractEnd: string | null; featured: boolean; operator: "OWNER" | "VIIPA"; keepVisible?: boolean }) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user) || !id.safeParse(listingId).success || (input.operator !== "OWNER" && input.operator !== "VIIPA")) return { ok: false };
  const result = await updatePlaceAdmin(user.id, listingId, { ...input, featured: input.featured === true, keepVisible: input.keepVisible === true });
  if (result.ok) refresh();
  return result;
}

const kigali = (day: string, time = "00:00") => new Date(`${day}T${time}:00+02:00`);

export async function createBlockAction(
  listingId: string,
  input: { roomId: string | null; kind: BlockKind; from: string; until: string | null; reason: string },
): Promise<BlockResult | { ok: false; error: "auth" }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const day = /^\d{4}-\d{2}-\d{2}$/;
  if (!id.safeParse(listingId).success || !BLOCK_KINDS.includes(input.kind) || !day.test(input.from) || (input.until && !day.test(input.until)) || typeof input.reason !== "string") {
    return { ok: false, error: "invalid" };
  }
  // Dates are whole days in Kigali; "until" is the last blocked day.
  const until = input.until ? new Date(kigali(input.until).getTime() + 86_400_000) : null;
  const result = await createBlock(user, listingId, { roomId: input.roomId || null, kind: input.kind, startsAt: kigali(input.from), endsAt: until, reason: input.reason });
  if (result.ok) refresh();
  return result;
}

export async function endBlockAction(blockId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(blockId).success) return { ok: false };
  const ok = await endBlock(user, blockId);
  if (ok) refresh();
  return { ok };
}

export async function savePayoutAction(input: PayoutInput) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, errors: { form: "auth" } };
  const result = await savePayoutAccount(user.id, input);
  if (result.ok) refresh();
  return result;
}

export async function verifyPayoutAction(userId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user) || !id.safeParse(userId).success) return { ok: false };
  const ok = await verifyPayoutAccount(user.id, userId);
  if (ok) refresh();
  return { ok };
}

export async function deleteDocumentAction(documentId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(documentId).success) return { ok: false };
  const ok = await deleteDocument(user, documentId);
  if (ok) refresh();
  return { ok };
}

/** Staff list owners by email when creating a place for someone. */
export async function findOwnerAction(email: string): Promise<{ id: string; name: string } | null> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user) || typeof email !== "string" || email.length > 200) return null;
  return db.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, name: true } });
}

export async function addTeamMemberAction(listingId: string, email: string, role: TeamRole): Promise<TeamResult | { ok: false; error: "auth" }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (!id.safeParse(listingId).success) return { ok: false, error: "invalid" };
  const result = await addTeamMember(user, listingId, email, role);
  if (result.ok) refresh();
  return result;
}

export async function removeTeamMemberAction(memberId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(memberId).success) return { ok: false };
  const ok = await removeTeamMember(user, memberId);
  if (ok) refresh();
  return { ok };
}
