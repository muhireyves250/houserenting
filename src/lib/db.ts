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
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // "require" already means full certificate checks in pg today; say so, so the driver doesn't warn (and a future
  // pg, where "require" gets weaker, keeps checking the certificate).
  const connectionString = url.replace(/([?&])sslmode=(prefer|require|verify-ca)(?=&|$)/, "$1sslmode=verify-full");
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
