import "server-only";
import { audit } from "@/features/audit/service";
import { newReference } from "@/features/bookings/reference";
import { notify } from "@/features/notifications/service";
import { db } from "@/lib/db";

export type OwnerBalance = {
  hostId: string;
  name: string;
  email: string;
  /** Owed for stays that have finished. */
  earned: number;
  /** Owed once paid stays finish. */
  upcoming: number;
  /** Already paid out. */
  paidOut: number;
  /** earned − paidOut: what can be paid now. */
  due: number;
  /** Monthly deposits held (returned or paid out under the deposit policy). */
  depositsHeld: number;
};

async function sumsFor(hostIds?: string[]) {
  const where = hostIds ? { hostId: { in: hostIds } } : { hostId: { not: null } };
  const [payable, settled, deposits] = await Promise.all([
    db.ledgerEntry.findMany({ where: { ...where, kind: "HOST_PAYABLE" }, select: { hostId: true, amount: true, booking: { select: { status: true } } } }),
    db.ledgerEntry.groupBy({ by: ["hostId"], where: { ...where, kind: "SETTLEMENT" }, _sum: { amount: true } }),
    db.ledgerEntry.groupBy({ by: ["hostId"], where: { ...where, kind: "DEPOSIT_HELD" }, _sum: { amount: true } }),
  ]);
  const balances = new Map<string, Omit<OwnerBalance, "name" | "email" | "due">>();
  const get = (id: string) => balances.get(id) ?? balances.set(id, { hostId: id, earned: 0, upcoming: 0, paidOut: 0, depositsHeld: 0 }).get(id)!;
  for (const entry of payable) {
    const b = get(entry.hostId!);
    if (entry.booking?.status === "COMPLETED") b.earned += entry.amount;
    else if (entry.booking?.status === "CONFIRMED" || entry.booking?.status === "CHECKED_IN") b.upcoming += entry.amount;
  }
  for (const row of settled) get(row.hostId!).paidOut += row._sum.amount ?? 0;
  for (const row of deposits) get(row.hostId!).depositsHeld += row._sum.amount ?? 0;
  return balances;
}

/** What each owner is owed, has been paid, and can be paid now. */
export async function ownerBalances(): Promise<OwnerBalance[]> {
  const balances = await sumsFor();
  const users = await db.user.findMany({ where: { id: { in: [...balances.keys()] } }, select: { id: true, name: true, email: true } });
  return users
    .map((u) => {
      const b = balances.get(u.id)!;
      return { ...b, name: u.name, email: u.email, due: b.earned - b.paidOut };
    })
    .sort((a, b) => b.due - a.due);
}

export async function hostEarnings(hostId: string) {
  const b = (await sumsFor([hostId])).get(hostId) ?? { hostId, earned: 0, upcoming: 0, paidOut: 0, depositsHeld: 0 };
  const payouts = await db.settlement.findMany({ where: { hostId }, orderBy: { createdAt: "desc" }, take: 20, select: { reference: true, amount: true, method: true, createdAt: true } });
  return { ...b, due: b.earned - b.paidOut, payouts };
}

export type SettlementResult = { ok: true; reference: string } | { ok: false; error: "invalid" | "tooMuch" };

/** Staff record a payout to an owner (never more than is due for finished stays). Logged in the ledger and audit log. */
export async function recordSettlement(
  adminId: string,
  input: { hostId: string; amount: number; method: string; externalReference: string },
): Promise<SettlementResult> {
  const method = input.method.trim().slice(0, 60);
  const externalReference = input.externalReference.trim().slice(0, 120);
  if (!Number.isInteger(input.amount) || input.amount < 1 || !method) return { ok: false, error: "invalid" };
  return db.$transaction(async (tx) => {
    // One payout at a time per owner, so two staff can't pay the same balance twice.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"settle:" + input.hostId}))`;
    const payable = await tx.ledgerEntry.aggregate({ where: { hostId: input.hostId, kind: "HOST_PAYABLE", booking: { status: "COMPLETED" } }, _sum: { amount: true } });
    const paid = await tx.ledgerEntry.aggregate({ where: { hostId: input.hostId, kind: "SETTLEMENT" }, _sum: { amount: true } });
    const due = (payable._sum.amount ?? 0) - (paid._sum.amount ?? 0);
    if (input.amount > due) return { ok: false, error: "tooMuch" } as const;
    const reference = newReference("ST");
    const settlement = await tx.settlement.create({
      data: { reference, hostId: input.hostId, amount: input.amount, method, externalReference: externalReference || null, createdById: adminId },
    });
    await tx.ledgerEntry.create({ data: { kind: "SETTLEMENT", amount: input.amount, hostId: input.hostId, settlementId: settlement.id } });
    await audit(tx, { actorId: adminId, action: "settlement.record", entityType: "settlement", entityId: reference, data: { hostId: input.hostId, amount: input.amount, method } });
    await notify(tx, input.hostId, "payoutRecorded", { amount: input.amount, reference }, "/host");
    return { ok: true, reference } as const;
  });
}

export function recentLedger(take = 100) {
  return db.ledgerEntry.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, kind: true, amount: true, createdAt: true, booking: { select: { reference: true } }, settlement: { select: { reference: true } } },
  });
}
