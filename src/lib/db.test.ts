import { describe, expect, it, vi } from "vitest";

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: class { $extends() { return this; } } }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: class {} }));
process.env.DATABASE_URL ??= "postgresql://test@localhost/test";

describe("isConnectionLost", () => {
  it("spots a connection the database closed, and nothing else", async () => {
    const { isConnectionLost } = await import("./db");
    expect(isConnectionLost(new Error("Invalid `db.session.findFirst()` invocation: Server has closed the connection."))).toBe(true);
    expect(isConnectionLost(new Error("Connection terminated unexpectedly"))).toBe(true);
    expect(isConnectionLost(new Error("Can't reach database server at ep-example.neon.tech"))).toBe(true);
    expect(isConnectionLost(new Error("Unique constraint failed on the fields: (`reference`)"))).toBe(false);
  });
});
