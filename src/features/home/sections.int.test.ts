import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { deleteSection, homeRows, hotDealIds, moveSection, saveSection, setHotDeal } from "./sections-service";

const admin = { id: "admin", role: "ADMIN" };
const house = (id: string, city: string, type: "APARTMENT" | "GUEST_HOUSE" = "APARTMENT") =>
  db.listing.create({
    data: { id, hostId: "host", title: `Home ${id}`, description: "Nice", type, status: "PUBLISHED", publishedAt: new Date(), addressLine: "KG 1", district: city, city, lat: -1.95, lng: 30.06, sizeM2: 50, rooms: 2, bedrooms: 1, bathrooms: 1, maxGuests: 2, rates: { create: [{ unit: "NIGHT", price: 40000 }] } },
  });

beforeEach(async () => {
  await resetDb();
  await db.listing.deleteMany();
  await db.user.createMany({ data: [{ id: "host", name: "Host", email: "host@example.com" }, { id: "g", name: "Guest", email: "g@example.com" }, { id: "admin", name: "Admin", email: "admin@example.com", role: "ADMIN" }] });
  for (const [id, city] of [["k1", "Kigali"], ["k2", "Kigali"], ["k3", "Kigali"], ["m1", "Musanze"]] as const) await house(id, city);
});

describe("home page sections run by VIIPA", () => {
  it("a section shows its picked houses first, then the others in its towns; it can be hidden, moved and removed", async () => {
    expect(await saveSection({ id: "g" }, null, { title: "Kigali", subtitle: "", places: ["Kigali"], types: [], mode: "short", houseIds: [], active: true })).toEqual({ ok: false, error: "notAllowed" });
    const kigali = await saveSection(admin, null, { title: "Popular in Kigali", subtitle: "", places: ["kigali"], types: [], mode: "short", houseIds: ["k3", "m1"], active: true });
    if (!kigali.ok) throw new Error("save failed");
    const rows = await homeRows();
    // Picked first (in order), then the rest of Kigali; Musanze only because it was picked.
    expect(rows[0]!.listings.map((l) => l.id).slice(0, 2)).toEqual(["k3", "m1"]);
    expect(rows[0]!.listings.map((l) => l.id).sort()).toEqual(["k1", "k2", "k3", "m1"]);
    // A guest choosing guest houses: nothing matches, the row disappears.
    expect(await homeRows(["GUEST_HOUSE"])).toEqual([]);
    const other = await saveSection(admin, null, { title: "Volcanoes", subtitle: "", places: ["Musanze"], types: [], mode: "short", houseIds: [], active: true });
    if (!other.ok) throw new Error("save failed");
    expect((await homeRows()).map((r) => r.title)).toEqual(["Popular in Kigali", "Volcanoes"]);
    expect(await moveSection(admin, other.id, "up")).toBe(true);
    expect((await homeRows()).map((r) => r.title)).toEqual(["Volcanoes", "Popular in Kigali"]);
    await saveSection(admin, other.id, { title: "Volcanoes", subtitle: "", places: ["Musanze"], types: [], mode: "short", houseIds: [], active: false });
    expect((await homeRows()).map((r) => r.title)).toEqual(["Popular in Kigali"]);
    expect(await deleteSection(admin, kigali.id)).toBe(true);
  });

  it("Hot deals: the houses VIIPA picks, then the most booked; it can't be removed", async () => {
    const hot = await db.homeSection.create({ data: { kind: "HOT_DEALS", title: "Hot deals", position: 0 } });
    const booked = (listingId: string, reference: string, day: number) =>
      db.booking.create({
        data: { reference, listingId, guestId: "g", status: "COMPLETED", checkIn: new Date(Date.UTC(2026, 9, day)), checkOut: new Date(Date.UTC(2026, 9, day + 1)), startAt: new Date(Date.UTC(2026, 9, day, 12)), endAt: new Date(Date.UTC(2026, 9, day + 1, 9)), nights: 1, guests: 1, nightlyPrice: 40000, subtotal: 40000, total: 40000, hostPayout: 36000, policySnapshot: {} },
      });
    await booked("k2", "SR-HOT001", 1);
    await booked("k2", "SR-HOT002", 3);
    await booked("k1", "SR-HOT003", 5);
    await db.homeSection.update({ where: { id: hot.id }, data: { houseIds: ["m1"] } });
    const [row] = await homeRows();
    expect(row!.listings.map((l) => l.id)).toEqual(["m1", "k2", "k1"]);
    expect(await deleteSection(admin, hot.id)).toBe(false);
  });

  it("staff add a house to Hot deals from its Actions (first there), and take it out", async () => {
    expect(await setHotDeal({ id: "g" }, "k1", true)).toEqual({ ok: false, error: "notAllowed" });
    await db.listing.update({ where: { id: "m1" }, data: { status: "HIDDEN" } });
    expect(await setHotDeal(admin, "m1", true)).toEqual({ ok: false, error: "notLive" });
    expect(await setHotDeal(admin, "k3", true)).toEqual({ ok: true });
    expect([...(await hotDealIds())]).toEqual(["k3"]);
    expect((await homeRows())[0]!.listings[0]!.id).toBe("k3");
    expect(await setHotDeal(admin, "k3", false)).toEqual({ ok: true });
    expect((await hotDealIds()).size).toBe(0);
  });
});
