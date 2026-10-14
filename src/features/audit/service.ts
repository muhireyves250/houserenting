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

export async function recentAudit({ entityType, entityId, take = 100 }: { entityType?: string; entityId?: string; take?: number } = {}) {
  return db.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, action: true, entityType: true, entityId: true, data: true, createdAt: true, actor: { select: { name: true, email: true } } },
  });
}
