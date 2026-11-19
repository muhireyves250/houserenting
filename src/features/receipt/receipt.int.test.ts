import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { getReceiptDetails, saveReceiptDetails } from "./service";

beforeEach(async () => {
  await resetDb();
  await db.user.create({ data: { id: "admin", name: "Admin", email: "admin@example.com", role: "ADMIN" } });
});

describe("receipt details", () => {
  it("only staff change them; empty fields are left off; a bad email is refused", async () => {
    const input = { businessName: "VIIPA Ltd", address: "KG 7 Ave, Kigali", phone: "+250 788 000 000", email: "hello@viipa.rw", tin: "123456789", footer: "Thank you!" };
    expect(await saveReceiptDetails({ id: "someone" }, input)).toEqual({ ok: false, error: "notAllowed" });
    expect(await saveReceiptDetails({ id: "admin", role: "ADMIN" }, { ...input, email: "not-an-email" })).toMatchObject({ ok: false, errors: { email: "email" } });
    expect(await saveReceiptDetails({ id: "admin", role: "ADMIN" }, { ...input, tin: "  " })).toEqual({ ok: true });
    const row = await db.platformConfig.findUniqueOrThrow({ where: { id: 1 } });
    expect([row.receiptBusinessName, row.receiptTin, row.receiptFooter]).toEqual(["VIIPA Ltd", null, "Thank you!"]);
    expect((await getReceiptDetails()).email).toBe("hello@viipa.rw");
  });
});
