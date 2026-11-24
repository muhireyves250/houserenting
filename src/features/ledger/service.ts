import "server-only";
import { audit } from "@/features/audit/service";
import { newReference } from "@/features/bookings/reference";
import { notify, notifyAdmins } from "@/features/notifications/service";
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

/** Food and laundry money (ledger notes "food OR-…", "laundry LD-…"): due as soon as it's paid, settled daily. */
export const isDailyService = (note: string | null | undefined) => Boolean(note && (note.startsWith("food ") || note.startsWith("laundry ")));

async function sumsFor(hostIds?: string[]) {
  const where = hostIds ? { hostId: { in: hostIds } } : { hostId: { not: null } };
  const [payable, settled, deposits] = await Promise.all([
    db.ledgerEntry.findMany({ where: { ...where, kind: "HOST_PAYABLE" }, select: { hostId: true, amount: true, note: true, booking: { select: { status: true } } } }),
    db.ledgerEntry.groupBy({ by: ["hostId"], where: { ...where, kind: "SETTLEMENT" }, _sum: { amount: true } }),
    db.ledgerEntry.groupBy({ by: ["hostId"], where: { ...where, kind: "DEPOSIT_HELD" }, _sum: { amount: true } }),
  ]);
  const balances = new Map<string, Omit<OwnerBalance, "name" | "email" | "due">>();
  const get = (id: string) => balances.get(id) ?? balances.set(id, { hostId: id, earned: 0, upcoming: 0, paidOut: 0, depositsHeld: 0 }).get(id)!;
  for (const entry of payable) {
    const b = get(entry.hostId!);
    // Restaurants and laundry are paid day by day (the service is done when it's paid); stays once they've ended.
    if (isDailyService(entry.note) || entry.booking?.status === "COMPLETED") b.earned += entry.amount;
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

/**
 * What one of an owner's places brought them: earned (finished stays and its guests' laundry) and still to come
 * (stays under way). Payouts are made to the owner for all their places together, so they aren't split by place.
 */
export async function placeEarnings(hostId: string, listingId: string) {
  const [entries, laundry] = await Promise.all([
    db.ledgerEntry.findMany({ where: { hostId, kind: "HOST_PAYABLE" }, select: { amount: true, note: true, booking: { select: { status: true, listingId: true } } } }),
    db.laundryOrder.findMany({ where: { listingId }, select: { reference: true } }),
  ]);
  const laundryNotes = new Set(laundry.map((l) => `laundry ${l.reference}`));
  let earned = 0;
  let upcoming = 0;
  for (const e of entries) {
    if (e.note && laundryNotes.has(e.note)) earned += e.amount;
    else if (e.booking?.listingId === listingId) {
      if (e.booking.status === "COMPLETED") earned += e.amount;
      else if (e.booking.status === "CONFIRMED" || e.booking.status === "CHECKED_IN") upcoming += e.amount;
    }
  }
  return { earned, upcoming };
}

export type PayoutRequestResult = { ok: true } | { ok: false; error: "nothingDue" | "noAccount" | "already" };

/** When the owner last asked VIIPA to pay them, if VIIPA hasn't paid them since (null: no request waiting). */
export async function payoutRequestedAt(hostId: string): Promise<Date | null> {
  const [request, paid] = await Promise.all([
    db.auditLog.findFirst({ where: { actorId: hostId, action: "payout.request", entityId: hostId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    db.settlement.findFirst({ where: { hostId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);
  return request && (!paid || request.createdAt > paid.createdAt) ? request.createdAt : null;
}

/** The owner asks VIIPA to send what they're owed now (to their checked payout account); staff are told. */
export async function requestPayout(hostId: string): Promise<PayoutRequestResult> {
  const [earnings, account, waiting, user] = await Promise.all([
    hostEarnings(hostId),
    db.payoutAccount.findUnique({ where: { userId: hostId }, select: { verifiedAt: true } }),
    payoutRequestedAt(hostId),
    db.user.findUnique({ where: { id: hostId }, select: { name: true } }),
  ]);
  if (earnings.due <= 0) return { ok: false, error: "nothingDue" };
  if (!account?.verifiedAt) return { ok: false, error: "noAccount" };
  if (waiting) return { ok: false, error: "already" };
  await db.$transaction(async (tx) => {
    await audit(tx, { actorId: hostId, action: "payout.request", entityType: "user", entityId: hostId, data: { amount: earnings.due } });
    await notifyAdmins(tx, "payoutRequested", { name: user?.name ?? "", amount: earnings.due }, `/admin/money/providers/${hostId}`);
  });
  return { ok: true };
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
    const payable = await tx.ledgerEntry.aggregate({ where: { hostId: input.hostId, kind: "HOST_PAYABLE", OR: [{ booking: { status: "COMPLETED" } }, { note: { startsWith: "food " } }, { note: { startsWith: "laundry " } }] }, _sum: { amount: true } });
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
    select: { id: true, kind: true, amount: true, note: true, createdAt: true, booking: { select: { reference: true } }, settlement: { select: { reference: true } } },
  });
}

/**
 * The money overview (requirements 5.1 and 5.4): money received, what providers are owed now and after stays, what
 * was paid out, VIIPA's commission and fees, promoter and referral commissions (paid and still owed), refunds,
 * expenses and net earnings. Only commission and fees count as VIIPA's revenue, never the whole payment.
 */
export async function moneyOverview() {
  const [byKind, promoter, referral, expenses, balances] = await Promise.all([
    db.ledgerEntry.groupBy({ by: ["kind"], _sum: { amount: true } }),
    db.promoterReward.findMany({ where: { status: { not: "VOID" } }, select: { amount: true, paidAt: true } }),
    db.referralReward.findMany({ where: { status: { not: "VOID" } }, select: { amount: true, status: true } }),
    db.expense.aggregate({ _sum: { amount: true } }),
    ownerBalances(),
  ]);
  const kind = (k: string) => byKind.find((r) => r.kind === k)?._sum.amount ?? 0;
  const promoterPaid = promoter.filter((r) => r.paidAt).reduce((n, r) => n + r.amount, 0);
  const promoterOwed = promoter.filter((r) => !r.paidAt).reduce((n, r) => n + r.amount, 0);
  // Referral rewards: approved ones are credited (paid); pending ones are still owed.
  const referralPaid = referral.filter((r) => r.status === "APPROVED").reduce((n, r) => n + r.amount, 0);
  const referralOwed = referral.filter((r) => r.status === "PENDING").reduce((n, r) => n + r.amount, 0);
  const revenue = kind("COMMISSION") + kind("GUEST_FEE");
  const spent = expenses._sum.amount ?? 0;
  return {
    received: kind("GUEST_PAYMENT"),
    dueNow: balances.reduce((n, b) => n + Math.max(0, b.due), 0),
    dueLater: balances.reduce((n, b) => n + b.upcoming, 0),
    paidOut: kind("SETTLEMENT"),
    revenue,
    promoterPaid,
    promoterOwed,
    referralPaid,
    referralOwed,
    refunds: kind("REFUND"),
    expenses: spent,
    net: revenue - promoterPaid - promoterOwed - referralPaid - referralOwed - spent,
  };
}

/** One provider's money account (requirements 5.5): their transactions, commission deducted, due now and later, paid. */
export async function providerStatement(hostId: string) {
  const [entries, sums, payouts] = await Promise.all([
    db.ledgerEntry.findMany({
      where: { OR: [{ hostId }, { booking: { listing: { hostId } }, kind: { in: ["GUEST_PAYMENT", "COMMISSION"] } }] },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, kind: true, amount: true, note: true, createdAt: true, booking: { select: { reference: true, status: true } }, settlement: { select: { reference: true } } },
    }),
    sumsFor([hostId]),
    db.settlement.findMany({ where: { hostId }, orderBy: { createdAt: "desc" }, select: { reference: true, amount: true, method: true, externalReference: true, createdAt: true } }),
  ]);
  const b = sums.get(hostId) ?? { hostId, earned: 0, upcoming: 0, paidOut: 0, depositsHeld: 0 };
  const total = (k: string) => entries.filter((e) => e.kind === k).reduce((n, e) => n + e.amount, 0);
  return { ...b, due: b.earned - b.paidOut, transactions: total("GUEST_PAYMENT"), commission: total("COMMISSION"), entries, payouts };
}

/** Restaurant and laundry money, day by day and provider by provider (for daily settlement). */
export async function dailySettlements(days = 14, now: Date = new Date()) {
  const since = new Date(now.getTime() - days * 86_400_000);
  const rows = await db.ledgerEntry.findMany({
    where: { kind: "HOST_PAYABLE", createdAt: { gte: since }, OR: [{ note: { startsWith: "food " } }, { note: { startsWith: "laundry " } }] },
    select: { hostId: true, amount: true, note: true, createdAt: true },
  });
  const day = (d: Date) => new Date(d.getTime() + 2 * 3_600_000).toISOString().slice(0, 10);
  const map = new Map<string, { day: string; hostId: string; food: number; laundry: number }>();
  for (const r of rows) {
    if (!r.hostId) continue;
    const key = `${day(r.createdAt)}|${r.hostId}`;
    const g = map.get(key) ?? map.set(key, { day: day(r.createdAt), hostId: r.hostId, food: 0, laundry: 0 }).get(key)!;
    if (r.note?.startsWith("food ")) g.food += r.amount;
    else g.laundry += r.amount;
  }
  const names = new Map((await db.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.hostId!).filter(Boolean))] } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  return [...map.values()].map((g) => ({ ...g, name: names.get(g.hostId) ?? "—" })).sort((a, b) => b.day.localeCompare(a.day) || a.name.localeCompare(b.name));
}
