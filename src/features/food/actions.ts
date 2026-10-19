"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";
import { ORDER_STATUSES, type OrderStatus } from "./rules";
import {
  addRestaurantMember,
  deleteMenuItem,
  moveOrder,
  placeOrder,
  removeRestaurantMember,
  saveMenuItem,
  saveRestaurant,
  setRestaurantPaused,
  setRestaurantStatus,
  type PlaceOrderResult,
  type RestaurantTeamRole,
  type SaveRestaurantResult,
} from "./service";
import type { MenuItemInput, OrderInput, RestaurantInput } from "./validation";

const id = z.string().min(1).max(64);
const refresh = () => revalidatePath("/[locale]", "layout");

export async function saveRestaurantAction(restaurantId: string | null, input: RestaurantInput, ownerEmail?: string | null): Promise<SaveRestaurantResult | { ok: false; error: "auth" }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (restaurantId !== null && !id.safeParse(restaurantId).success) return { ok: false, error: "notAllowed" };
  // Staff can create a restaurant for an owner's account.
  let ownerId: string | undefined;
  if (restaurantId === null && ownerEmail && isAdmin(user)) {
    const owner = await db.user.findUnique({ where: { email: ownerEmail.trim().toLowerCase() }, select: { id: true } });
    if (!owner) return { ok: false, errors: { ownerEmail: "noAccount" } };
    ownerId = owner.id;
  }
  const result = await saveRestaurant(user, restaurantId, input, ownerId);
  if (result.ok) refresh();
  return result;
}

export async function setRestaurantStatusAction(restaurantId: string, status: "PUBLISHED" | "HIDDEN", reason: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(restaurantId).success || (status !== "PUBLISHED" && status !== "HIDDEN")) return { ok: false };
  const ok = await setRestaurantStatus(user, restaurantId, status, typeof reason === "string" ? reason : "");
  if (ok) refresh();
  return { ok };
}

export async function setRestaurantPausedAction(restaurantId: string, paused: boolean): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(restaurantId).success || typeof paused !== "boolean") return { ok: false };
  const ok = await setRestaurantPaused(user, restaurantId, paused);
  if (ok) refresh();
  return { ok };
}

export async function saveMenuItemAction(restaurantId: string, itemId: string | null, input: MenuItemInput) {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(restaurantId).success || (itemId !== null && !id.safeParse(itemId).success)) return { ok: false as const, errors: { form: "auth" } };
  const result = await saveMenuItem(user, restaurantId, itemId, input);
  if (result.ok) refresh();
  return result;
}

export async function deleteMenuItemAction(itemId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(itemId).success) return { ok: false };
  const ok = await deleteMenuItem(user, itemId);
  if (ok) refresh();
  return { ok };
}

export async function addRestaurantMemberAction(restaurantId: string, email: string, role: RestaurantTeamRole) {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(restaurantId).success) return { ok: false as const, error: "notAllowed" as const };
  const result = await addRestaurantMember(user, restaurantId, email, role);
  if (result.ok) refresh();
  return result;
}

export async function removeRestaurantMemberAction(memberId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(memberId).success) return { ok: false };
  const ok = await removeRestaurantMember(user, memberId);
  if (ok) refresh();
  return { ok };
}

export async function placeOrderAction(input: OrderInput): Promise<PlaceOrderResult | { ok: false; error: "auth" }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const result = await placeOrder(user.id, input);
  if (result.ok) refresh();
  return result;
}

export async function moveOrderAction(reference: string, to: OrderStatus, note: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || typeof reference !== "string" || reference.length > 20 || !ORDER_STATUSES.includes(to)) return { ok: false };
  const ok = await moveOrder(user, reference, to, typeof note === "string" ? note : "");
  if (ok) refresh();
  return { ok };
}
