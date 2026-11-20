"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canStaff, ROLES, type AppRole, type StaffArea } from "@/lib/roles";
import { getLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { deleteUser, reviewListing, sendPasswordReset, setStaffAreas, setUserRole, unpublishListing, type AccountActionResult } from "./service";

const id = z.string().min(1).max(64);
const reason = z.string().max(500);

/** Every staff action checks the role on the server; hidden buttons alone protect nothing. */
async function staff(area: StaffArea) {
  const user = await getCurrentUser();
  return user && canStaff(user, area) ? user : null;
}

export async function reviewListingAction(listingId: string, approve: boolean, why = ""): Promise<{ ok: boolean }> {
  const admin = await staff("listings");
  if (!admin || !id.safeParse(listingId).success || !reason.safeParse(why).success) return { ok: false };
  const ok = await reviewListing(admin.id, listingId, approve ? { approve: true } : { approve: false, reason: why });
  if (ok) {
    revalidatePath("/[locale]/admin", "layout");
    revalidatePath(`/[locale]/listings/${listingId}`, "page");
  }
  return { ok };
}

export async function unpublishListingAction(listingId: string, why: string): Promise<{ ok: boolean }> {
  const admin = await staff("listings");
  if (!admin || !id.safeParse(listingId).success || !reason.safeParse(why).success) return { ok: false };
  const ok = await unpublishListing(admin.id, listingId, why);
  if (ok) revalidatePath("/[locale]", "layout");
  return { ok };
}

export async function setUserRoleAction(userId: string, role: AppRole): Promise<{ ok: boolean }> {
  const admin = await staff("settings");
  if (!admin || !id.safeParse(userId).success || !(ROLES as readonly string[]).includes(role)) return { ok: false };
  const ok = await setUserRole(admin.id, userId, role);
  if (ok) revalidatePath("/[locale]/admin/users", "page");
  return { ok };
}

/** Which parts of the dashboard an admin may manage (super admins only; checked again in the service). */
export async function setStaffAreasAction(userId: string, areas: string[]): Promise<{ ok: boolean }> {
  const admin = await staff("settings");
  if (!admin || !id.safeParse(userId).success || !Array.isArray(areas) || areas.length > 20) return { ok: false };
  const ok = await setStaffAreas(admin.id, userId, areas);
  if (ok) revalidatePath("/[locale]/admin", "layout");
  return { ok };
}

/** Email the person a link to choose a new password. */
export async function sendPasswordResetAction(userId: string): Promise<AccountActionResult> {
  const admin = await staff("settings");
  if (!admin) return { ok: false, error: "notAllowed" };
  if (!id.safeParse(userId).success) return { ok: false, error: "notFound" };
  return sendPasswordReset(admin.id, userId, `/${await getLocale()}/reset-password`);
}

/** Delete an account without history (others are suspended instead). */
export async function deleteUserAction(userId: string): Promise<AccountActionResult> {
  const admin = await staff("settings");
  if (!admin) return { ok: false, error: "notAllowed" };
  if (!id.safeParse(userId).success) return { ok: false, error: "notFound" };
  const result = await deleteUser(admin.id, userId);
  if (result.ok) revalidatePath("/[locale]/admin", "layout");
  return result;
}

/** People to pick from (name or email), e.g. when adding a promoter: newest first, at most 20. */
export async function findPeopleAction(q: string): Promise<{ id: string; name: string; email: string }[]> {
  const admin = (await staff("promotions")) ?? (await staff("settings"));
  if (!admin) return [];
  const query = String(q ?? "").trim().slice(0, 80);
  return db.user.findMany({
    where: {
      role: "USER",
      ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, name: true, email: true },
  });
}

/** Make someone a place owner (host), or take it away. */
export async function setHostAccessAction(userId: string, isHost: boolean): Promise<import("./service").HostAccessResult> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(userId).success || typeof isHost !== "boolean") return { ok: false, error: "notAllowed" };
  const { setHostAccess } = await import("./service");
  const result = await setHostAccess(user, userId, isHost);
  if (result.ok) revalidatePath("/[locale]/admin/users", "layout");
  return result;
}
