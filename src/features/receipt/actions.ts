"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { saveReceiptDetails, type SaveReceiptResult } from "./service";
import type { ReceiptInput } from "./validation";

export async function saveReceiptAction(
  input: ReceiptInput,
): Promise<SaveReceiptResult> {
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

/** Staff: send a payment's receipt (PDF) to the client's chat. */
export async function sendReceiptToChatAction(
  paymentId: string,
): Promise<import("./send").SendReceiptResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "notAllowed" };
  if (typeof paymentId !== "string" || !/^[a-z0-9]{10,40}$/i.test(paymentId))
    return { ok: false, error: "notFound" };
  const { sendReceiptToChat } = await import("./send");
  const result = await sendReceiptToChat(user, paymentId);
  if (result.ok) revalidatePath("/[locale]", "layout");
  return result;
}
