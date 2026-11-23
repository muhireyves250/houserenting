import "server-only";
import { audit } from "@/features/audit/service";
import { db } from "@/lib/db";
import { canStaff } from "@/lib/roles";

type Actor = { id: string; role?: string | null; staffAreas?: readonly string[] | null };
export const EXPENSE_CATEGORIES = ["SALARIES", "RENT", "MARKETING", "TRANSPORT", "INTERNET", "SOFTWARE", "FEES", "OTHER"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Records one of VIIPA's operating expenses (for net earnings). Staff handling money; logged. */
export async function addExpense(actor: Actor, input: { spentOn: string; category: string; description: string; amount: number; reference?: string | null }): Promise<boolean> {
  if (!canStaff(actor, "money")) return false;
  const description = String(input.description ?? "").trim().slice(0, 200);
  const day = new Date(`${input.spentOn}T12:00:00+02:00`);
  if (!EXPENSE_CATEGORIES.includes(input.category as ExpenseCategory) || !description || Number.isNaN(day.getTime()) || !Number.isInteger(input.amount) || input.amount < 1 || input.amount > 1_000_000_000) return false;
  await db.$transaction(async (tx) => {
    const e = await tx.expense.create({ data: { spentOn: day, category: input.category, description, amount: input.amount, reference: input.reference?.trim().slice(0, 80) || null, createdById: actor.id } });
    await audit(tx, { actorId: actor.id, action: "expense.add", entityType: "expense", entityId: e.id, data: { amount: e.amount, category: e.category } });
  });
  return true;
}

export async function deleteExpense(actor: Actor, id: string): Promise<boolean> {
  if (!canStaff(actor, "money")) return false;
  return db.$transaction(async (tx) => {
    const e = await tx.expense.findUnique({ where: { id }, select: { amount: true, description: true } });
    if (!e) return false;
    await tx.expense.delete({ where: { id } });
    await audit(tx, { actorId: actor.id, action: "expense.delete", entityType: "expense", entityId: id, data: e });
    return true;
  });
}

export function recentExpenses(take = 50) {
  return db.expense.findMany({ orderBy: [{ spentOn: "desc" }, { createdAt: "desc" }], take });
}
