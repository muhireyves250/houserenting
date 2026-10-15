"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isBookingReference } from "@/features/bookings/reference";
import { staffMoveBooking } from "@/features/bookings/service";
import { moderateQuestion } from "@/features/questions/service";
import { moderateReview } from "@/features/reviews/service";
import { isAdmin } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

const id = z.string().min(1).max(64);

async function staff() {
  const user = await getCurrentUser();
  return user && isAdmin(user) ? user : null;
}

export async function moderateQuestionAction(questionId: string, publish: boolean): Promise<{ ok: boolean }> {
  const admin = await staff();
  if (!admin || !id.safeParse(questionId).success) return { ok: false };
  const ok = await moderateQuestion(admin.id, questionId, publish === true);
  if (ok) revalidatePath("/[locale]", "layout");
  return { ok };
}

export async function moderateReviewAction(reviewId: string, publish: boolean): Promise<{ ok: boolean }> {
  const admin = await staff();
  if (!admin || !id.safeParse(reviewId).success) return { ok: false };
  const ok = await moderateReview(admin.id, reviewId, publish === true);
  if (ok) revalidatePath("/[locale]", "layout");
  return { ok };
}

export async function moveBookingAction(reference: string, to: "CHECKED_IN" | "COMPLETED"): Promise<{ ok: boolean }> {
  const admin = await staff();
  if (!admin || typeof reference !== "string" || !isBookingReference(reference) || (to !== "CHECKED_IN" && to !== "COMPLETED")) return { ok: false };
  const ok = await staffMoveBooking(admin.id, reference, to);
  if (ok) revalidatePath("/[locale]/admin/bookings", "page");
  return { ok };
}

export async function staffCancelBookingAction(reference: string, reason: string): Promise<{ ok: boolean }> {
  const admin = await staff();
  if (!admin || typeof reference !== "string" || !isBookingReference(reference) || typeof reason !== "string" || reason.length > 300) return { ok: false };
  const { staffCancelUnpaid } = await import("./queries");
  const ok = await staffCancelUnpaid(admin.id, reference, reason);
  if (ok) revalidatePath("/[locale]/admin", "layout");
  return { ok };
}

export async function setUserStatusAction(userId: string, status: "ACTIVE" | "SUSPENDED", reason: string): Promise<{ ok: boolean }> {
  const admin = await staff();
  if (!admin || !id.safeParse(userId).success || (status !== "ACTIVE" && status !== "SUSPENDED") || typeof reason !== "string" || reason.length > 300) return { ok: false };
  const { setUserStatus } = await import("./queries");
  const ok = await setUserStatus(admin.id, userId, status, reason);
  if (ok) revalidatePath("/[locale]/admin/users", "layout");
  return { ok };
}
