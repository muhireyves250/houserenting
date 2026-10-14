"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAdmin } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import { reviewListing, setUserRole, unpublishListing } from "./service";

const id = z.string().min(1).max(64);
const reason = z.string().max(500);

/** Every staff action checks the role on the server; hidden buttons alone protect nothing. */
async function staff() {
  const user = await getCurrentUser();
  return user && isAdmin(user) ? user : null;
}

export async function reviewListingAction(listingId: string, approve: boolean, why = ""): Promise<{ ok: boolean }> {
  const admin = await staff();
  if (!admin || !id.safeParse(listingId).success || !reason.safeParse(why).success) return { ok: false };
  const ok = await reviewListing(admin.id, listingId, approve ? { approve: true } : { approve: false, reason: why });
  if (ok) {
    revalidatePath("/[locale]/admin", "layout");
    revalidatePath(`/[locale]/listings/${listingId}`, "page");
  }
  return { ok };
}

export async function unpublishListingAction(listingId: string, why: string): Promise<{ ok: boolean }> {
  const admin = await staff();
  if (!admin || !id.safeParse(listingId).success || !reason.safeParse(why).success) return { ok: false };
  const ok = await unpublishListing(admin.id, listingId, why);
  if (ok) revalidatePath("/[locale]", "layout");
  return { ok };
}

export async function setUserRoleAction(userId: string, role: "USER" | "ADMIN"): Promise<{ ok: boolean }> {
  const admin = await staff();
  if (!admin || !id.safeParse(userId).success || (role !== "USER" && role !== "ADMIN")) return { ok: false };
  const ok = await setUserRole(admin.id, userId, role);
  if (ok) revalidatePath("/[locale]/admin/users", "page");
  return { ok };
}
