"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { canStaff } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";
import { ORDER_STATUSES, type OrderStatus } from "./rules";
import {
  claimOrderPayment,
  confirmOrderPayment,
  deleteFoodOrder,
  deleteRestaurant,
  hideMyOrder,
  type ClaimOrderResult,
  type ConfirmOrderResult,
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
  assignCourier,
  rateOrder,
  setPlaceKitchens,
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
  if (restaurantId === null && ownerEmail && canStaff(user, "food")) {
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

export async function hideMyOrderAction(reference: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !z.string().min(1).max(40).safeParse(reference).success) return { ok: false };
  const ok = await hideMyOrder(user.id, reference);
  refresh();
  return { ok };
}

export async function claimOrderPaymentAction(reference: string, transactionId: string): Promise<ClaimOrderResult | { ok: false; error: "auth" }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (!z.string().min(1).max(40).safeParse(reference).success) return { ok: false, error: "notFound" };
  const result = await claimOrderPayment(user.id, reference, String(transactionId ?? ""));
  refresh();
  return result;
}

export async function confirmOrderPaymentAction(reference: string, transactionId: string): Promise<ConfirmOrderResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "notAllowed" };
  if (!z.string().min(1).max(40).safeParse(reference).success) return { ok: false, error: "notFound" };
  const result = await confirmOrderPayment(user, reference, String(transactionId ?? "") || undefined);
  refresh();
  return result;
}

export async function deleteRestaurantAction(restaurantId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(restaurantId).success) return { ok: false };
  const result = await deleteRestaurant(user, restaurantId);
  if (result.ok) refresh();
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function deleteFoodOrderAction(reference: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !z.string().min(1).max(40).safeParse(reference).success) return { ok: false };
  const ok = await deleteFoodOrder(user, reference);
  if (ok) refresh();
  return { ok };
}

/** The kitchen hands a ready order to one of its delivery people. */
export async function assignCourierAction(reference: string, courierId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || typeof reference !== "string" || reference.length > 20 || typeof courierId !== "string" || courierId.length > 64) return { ok: false };
  const ok = await assignCourier(user, reference, courierId);
  if (ok) revalidatePath("/[locale]", "layout");
  return { ok };
}

/** The guest rates their delivered order (1–5) with an optional comment. */
export async function rateOrderAction(reference: string, rating: number, comment: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || typeof reference !== "string" || reference.length > 20) return { ok: false };
  const ok = await rateOrder(user.id, reference, Number(rating), String(comment ?? ""));
  if (ok) revalidatePath("/[locale]", "layout");
  return { ok };
}

/** Staff set the restaurants that cook for a place (from the place's admin page). */
export async function setPlaceKitchensAction(listingId: string, restaurantIds: string[]): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(listingId).success || !z.array(id).max(30).safeParse(restaurantIds).success) return false;
  const ok = await setPlaceKitchens(user, listingId, restaurantIds);
  if (ok) refresh();
  return ok;
}
