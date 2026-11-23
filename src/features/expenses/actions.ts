"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { addExpense, deleteExpense } from "./service";

export async function addExpenseAction(input: { spentOn: string; category: string; description: string; amount: number; reference?: string | null }): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || typeof input !== "object" || input === null) return { ok: false };
  const ok = await addExpense(user, input);
  if (ok) revalidatePath("/[locale]/admin", "layout");
  return { ok };
}

export async function deleteExpenseAction(id: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || typeof id !== "string" || id.length > 40) return { ok: false };
  const ok = await deleteExpense(user, id);
  if (ok) revalidatePath("/[locale]/admin", "layout");
  return { ok };
}
