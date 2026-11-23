"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { setAgreement, type AgreementResult, type Subject } from "./service";

/** Record a commission agreement (a % or a fixed fee) from a date. */
export async function setAgreementAction(subject: Subject, subjectId: string, input: { percent?: number | null; fixedFee?: number | null; effectiveFrom?: string | null; note?: string | null }): Promise<AgreementResult> {
  const user = await getCurrentUser();
  if (!user || !["PLACE", "RESTAURANT", "LAUNDRY"].includes(subject) || typeof subjectId !== "string" || subjectId.length > 64) return { ok: false, error: "notAllowed" };
  const result = await setAgreement(user, subject, subjectId, input);
  if (result.ok) revalidatePath("/[locale]", "layout");
  return result;
}
