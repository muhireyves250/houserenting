import { beforeEach, describe, expect, it } from "vitest";
import { canManageStaff, setUserRole } from "@/features/admin/service";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { canOn, placeRole } from "./access";
import { createBlock } from "./blocks-service";
import { portalBookings } from "./portal";
import { addTeamMember, removeTeamMember } from "./team-service";

beforeEach(async () => {
  await resetDb();
  await db.listing.deleteMany();
  await db.user.createMany({
    data: [
      { id: "owner", name: "Owner", email: "owner@example.com" },
      { id: "manager", name: "Manager", email: "manager@example.com" },
      { id: "desk", name: "Desk", email: "desk@example.com" },
      { id: "admin", name: "Admin", email: "admin@example.com", role: "ADMIN" },
      { id: "admin2", name: "Admin 2", email: "admin2@example.com", role: "ADMIN" },
    ],
  });
  for (const id of ["a", "b"]) {
    await db.listing.create({
      data: {
        id,
        hostId: "owner",
        title: `Place ${id}`,
        description: "Nice",
        type: "APARTMENT",
        status: "PUBLISHED",
        addressLine: "KG 1",
        district: "Gasabo",
        city: "Kigali",
        lat: -1.95,
        lng: 30.06,
        sizeM2: 60,
        rooms: 2,
        bedrooms: 1,
        bathrooms: 1,
        maxGuests: 2,
      },
    });
  }
});

describe("place teams", () => {
  it("the owner adds a manager and a receptionist, each limited to their role and place", async () => {
    expect(await addTeamMember({ id: "manager" }, "a", "desk@example.com", "RECEPTIONIST")).toEqual({ ok: false, error: "notAllowed" });
    expect(await addTeamMember({ id: "owner" }, "a", "nobody@example.com", "MANAGER")).toEqual({ ok: false, error: "noAccount" });
    expect(await addTeamMember({ id: "owner" }, "a", "owner@example.com", "MANAGER")).toEqual({ ok: false, error: "isOwner" });
    expect(await addTeamMember({ id: "owner" }, "a", "manager@example.com", "MANAGER")).toEqual({ ok: true });
    expect(await addTeamMember({ id: "owner" }, "a", "desk@example.com", "RECEPTIONIST")).toEqual({ ok: true });

    expect(await placeRole({ id: "manager" }, "a")).toBe("manager");
    expect(await placeRole({ id: "manager" }, "b")).toBeNull();
    expect(await canOn({ id: "manager" }, "a", "blocks")).toBe(true);
    expect(await canOn({ id: "manager" }, "a", "money")).toBe(false);
    expect(await canOn({ id: "desk" }, "a", "checkIn")).toBe(true);
    expect(await canOn({ id: "desk" }, "a", "edit")).toBe(false);

    const block = { roomId: null, kind: "MAINTENANCE" as const, startsAt: new Date("2026-12-01T00:00:00Z"), endsAt: null, reason: "Paint" };
    expect((await createBlock({ id: "manager" }, "a", block)).ok).toBe(true);
    expect(await createBlock({ id: "desk" }, "a", block)).toEqual({ ok: false, error: "notAllowed" });

    expect((await portalBookings("desk")).places).toBe(1);
    expect((await portalBookings("owner")).places).toBe(2);
    expect(await db.notification.count({ where: { kind: "teamAdded" } })).toBe(2);

    const member = await db.placeMember.findFirstOrThrow({ where: { userId: "desk" } });
    expect(await removeTeamMember({ id: "manager" }, member.id)).toBe(false);
    expect(await removeTeamMember({ id: "owner" }, member.id)).toBe(true);
    expect(await placeRole({ id: "desk" }, "a")).toBeNull();
  });
});

describe("staff access", () => {
  it("any admin manages staff until a super admin exists; then only super admins do", async () => {
    expect(await canManageStaff({ id: "admin", role: "ADMIN" })).toBe(true);
    expect(await setUserRole("admin", "admin2", "SUPER_ADMIN")).toBe(true);
    expect(await canManageStaff({ id: "admin", role: "ADMIN" })).toBe(false);
    expect(await setUserRole("admin", "owner", "ADMIN")).toBe(false);
    expect(await setUserRole("admin2", "owner", "ADMIN")).toBe(true);
    expect(await setUserRole("admin2", "admin2", "USER")).toBe(false);
  });
});
