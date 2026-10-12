import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { getProfile, updateProfile } from "./service";

describe("profile service", () => {
  beforeEach(async () => {
    await resetDb();
    await db.user.create({ data: { id: "u1", name: "Alona", email: "alona@example.com" } });
    await db.user.create({ data: { id: "u2", name: "Other", email: "other@example.com" } });
  });

  it("returns only public profile fields", async () => {
    expect(await getProfile("u1")).toEqual({ name: "Alona", email: "alona@example.com", emailVerified: false, phone: null, locale: "en" });
  });

  it("updates name, phone and locale for that user only", async () => {
    await updateProfile("u1", { name: "Alona K", phone: "+250788123456", locale: "fr" });
    expect(await getProfile("u1")).toMatchObject({ name: "Alona K", phone: "+250788123456", locale: "fr" });
    expect(await getProfile("u2")).toMatchObject({ name: "Other", phone: null, locale: "en" });
  });

  it("can clear the phone number", async () => {
    await updateProfile("u1", { name: "Alona", phone: "+250788123456", locale: "en" });
    await updateProfile("u1", { name: "Alona", phone: null, locale: "en" });
    expect((await getProfile("u1"))?.phone).toBeNull();
  });
});
