import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForDb = globalThis as unknown as { db?: PrismaClient };

/** Errors that mean the connection was closed under us (Neon closes idle ones and suspends when quiet). */
const CONNECTION_LOST = /server has closed the connection|connection terminated|connection is closed|terminating connection|ECONNRESET|Client has encountered a connection error/i;

/** Reads are safe to run again; writes never are (they could be saved twice). */
const READS = new Set(["findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow", "findMany", "count", "aggregate", "groupBy"]);

export function isConnectionLost(error: unknown): boolean {
  const text = error instanceof Error ? `${error.message} ${(error as { cause?: unknown }).cause ?? ""}` : String(error);
  return CONNECTION_LOST.test(text);
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const client = new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      // Drop idle connections before Neon does, and keep busy ones alive through quiet networks.
      idleTimeoutMillis: 20_000,
      keepAlive: true,
      connectionTimeoutMillis: 15_000,
    }),
    // Remote DB + cold TLS connections can exceed the 2s default wait for a pool slot.
    transactionOptions: { maxWait: 10_000, timeout: 15_000 },
  });
  // A read that hits a connection Neon just closed is tried once more on a fresh one.
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          try {
            return await query(args);
          } catch (error) {
            if (!READS.has(operation) || !isConnectionLost(error)) throw error;
            return query(args);
          }
        },
      },
    },
  }) as unknown as PrismaClient;
}

export const db = globalForDb.db ?? createClient();

if (process.env.NODE_ENV !== "production") globalForDb.db = db;
