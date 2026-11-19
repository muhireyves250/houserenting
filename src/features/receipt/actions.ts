"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { saveReceiptDetails, type SaveReceiptResult } from "./service";
import type { ReceiptInput } from "./validation";

export async function saveReceiptAction(input: ReceiptInput): Promise<SaveReceiptResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "notAllowed" };
  const result = await saveReceiptDetails(user, {
    businessName: String(input?.businessName ?? ""),
    address: String(input?.address ?? ""),
    phone: String(input?.phone ?? ""),
    email: String(input?.email ?? ""),
    tin: String(input?.tin ?? ""),
    footer: String(input?.footer ?? ""),
  });
  if (result.ok) revalidatePath("/[locale]", "layout");
  return result;
}
