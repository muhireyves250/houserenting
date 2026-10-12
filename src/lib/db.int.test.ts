import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";

describe("database", () => {
  beforeEach(resetDb);

  it("creates users with launch defaults", async () => {
    const user = await db.user.create({ data: { id: "u1", name: "Alona", email: "alona@example.com" } });
    expect(user).toMatchObject({ role: "USER", isHost: false, locale: "en", status: "ACTIVE", emailVerified: false, phone: null });
  });

  it("rejects a second user with the same email", async () => {
    await db.user.create({ data: { id: "u1", name: "A", email: "same@example.com" } });
    await expect(db.user.create({ data: { id: "u2", name: "B", email: "same@example.com" } })).rejects.toMatchObject({ code: "P2002" });
  });

  it("resetDb refuses to run when ALLOW_DB_RESET is not set", async () => {
    delete process.env.ALLOW_DB_RESET;
    try {
      await expect(resetDb()).rejects.toThrow(/refused/);
    } finally {
      process.env.ALLOW_DB_RESET = "1";
    }
  });
});
