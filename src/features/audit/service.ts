import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

type Client = Prisma.TransactionClient | typeof db;

export type AuditEntry = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  data?: Prisma.InputJsonValue;
};

/** Records who did what; pass the transaction so the log and the change commit together. */
export async function audit(client: Client, entry: AuditEntry): Promise<void> {
  await client.auditLog.create({ data: entry });
}

export async function recentAudit({
  entityType,
  entityTypes,
  entityId,
  take = 100,
  skip = 0,
}: { entityType?: string; entityTypes?: string[]; entityId?: string; take?: number; skip?: number } = {}) {
  return db.auditLog.findMany({
    where: { entityType: entityTypes ? { in: entityTypes } : entityType, entityId },
    orderBy: { createdAt: "desc" },
    take,
    skip,
    select: { id: true, action: true, entityType: true, entityId: true, data: true, createdAt: true, actor: { select: { name: true, email: true } } },
  });
}

export function countAudit(entityTypes?: string[]) {
  return db.auditLog.count({ where: entityTypes ? { entityType: { in: entityTypes } } : {} });
}
