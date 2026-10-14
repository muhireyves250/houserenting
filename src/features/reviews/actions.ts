"use server";

import { revalidatePath } from "next/cache";
import { isBookingReference } from "@/features/bookings/reference";
import { getCurrentUser } from "@/lib/session";
import { submitReview, type ReviewResult } from "./service";

export async function submitReviewAction(reference: string, rating: number, comment: string): Promise<ReviewResult | { ok: false; error: "auth" }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (typeof reference !== "string" || !isBookingReference(reference) || typeof comment !== "string" || typeof rating !== "number") {
    return { ok: false, error: "invalid" };
  }
  const result = await submitReview(user.id, reference, rating, comment);
  if (result.ok) revalidatePath(`/[locale]/bookings/${reference}`, "page");
  return result;
}
