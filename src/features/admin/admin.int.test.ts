import { beforeEach, describe, expect, it } from "vitest";
import { createBooking } from "@/features/bookings/service";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { unreadChats } from "@/features/chats/service";
import { laundryToHandle } from "@/features/laundry/service";
import { unreadCount } from "@/features/notifications/service";
import { moveLaundry } from "@/features/laundry/service";
import { deletePlace } from "@/features/places/status-service";
import { deletePromo } from "@/features/promotions/service";
import { notifyAdmins } from "@/features/notifications/service";
import { deleteUser, sendPasswordReset, setStaffAreas, setUserRole } from "./service";
import { adminBadges, attentionCounts, dashboardStats } from "./stats";
import { bookingsCsv, searchBookings, setUserStatus, staffCancelUnpaid } from "./queries";

const NOW = new Date("2026-10-15T08:00:00Z");
const pay = { method: "mtn" as const, phone: "0788123456" };

beforeEach(async () => {
  await resetDb();
  await db.listing.deleteMany();
  await db.user.createMany({
    data: [
      { id: "admin", name: "Admin", email: "admin@example.com", role: "ADMIN", emailVerified: true },
      { id: "host", name: "Host", email: "host@example.com" },
      { id: "g1", name: "Eric Guest", email: "eric@example.com" },
    ],
  });
  await db.listing.create({
    data: {
      id: "flat",
      hostId: "host",
      title: "City flat",
      description: "Nice",
      type: "APARTMENT",
      status: "PUBLISHED",
      addressLine: "KG 1",
      district: "Gasabo",
      city: "Kigali",
      lat: -1.95,
      lng: 30.06,
      sizeM2: 60,
      rooms: 3,
      bedrooms: 2,
      bathrooms: 1,
      maxGuests: 4,
      rates: { create: [{ unit: "NIGHT", price: 50000 }] },
    },
  });
});

describe("staff tools", () => {
  it("find bookings by guest or reference and filter by status; export them as CSV", async () => {
    const r = await createBooking({ guestId: "g1", listingId: "flat", checkIn: "2026-11-01", checkOut: "2026-11-03", guests: 1, payment: pay }, NOW);
    const reference = r.ok ? r.reference : "";
    expect((await searchBookings({ q: "eric" })).rows.map((b) => b.reference)).toEqual([reference]);
    expect((await searchBookings({ q: reference.toLowerCase() })).total).toBe(1);
    expect((await searchBookings({ status: "CONFIRMED" })).total).toBe(0);
    expect((await searchBookings({})).counts).toEqual({ PENDING_PAYMENT: 1 });
    expect(await bookingsCsv()).toContain(`"${reference}","PENDING_PAYMENT"`);
  });

  it("release an unpaid hold only with a reason, and tell the guest", async () => {
    const r = await createBooking({ guestId: "g1", listingId: "flat", checkIn: "2026-11-01", checkOut: "2026-11-03", guests: 1, payment: pay }, NOW);
    const reference = r.ok ? r.reference : "";
    expect(await staffCancelUnpaid("admin", reference, "  ")).toBe(false);
    expect(await staffCancelUnpaid("admin", reference, "Guest asked by phone")).toBe(true);
    expect(await staffCancelUnpaid("admin", reference, "again")).toBe(false);
    const booking = await db.booking.findUniqueOrThrow({ where: { reference }, include: { events: true } });
    expect(booking.status).toBe("CANCELLED");
    expect(booking.events.at(-1)).toMatchObject({ actorId: "admin", reason: "Guest asked by phone" });
    expect(await db.notification.findFirst({ where: { userId: "g1", kind: "bookingCancelled" } })).not.toBeNull();
  });

  it("suspend an account: signed out everywhere, can't sign in, and never yourself", async () => {
    await auth.api.signUpEmail({ body: { name: "Sue", email: "sue@example.com", password: "Long-enough-pass-1" } });
    const sue = await db.user.findUniqueOrThrow({ where: { email: "sue@example.com" } });
    await db.user.update({ where: { id: sue.id }, data: { emailVerified: true } });
    await auth.api.signInEmail({ body: { email: "sue@example.com", password: "Long-enough-pass-1" } });
    expect(await db.session.count({ where: { userId: sue.id } })).toBeGreaterThan(0);

    expect(await setUserStatus("admin", "admin", "SUSPENDED", "testing")).toBe(false);
    expect(await setUserStatus("admin", sue.id, "SUSPENDED", "")).toBe(false);
    expect(await setUserStatus("admin", sue.id, "SUSPENDED", "Fake listings")).toBe(true);
    expect(await db.session.count({ where: { userId: sue.id } })).toBe(0);
    await expect(auth.api.signInEmail({ body: { email: "sue@example.com", password: "Long-enough-pass-1" } })).rejects.toMatchObject({ body: { code: "ACCOUNT_SUSPENDED" } });

    expect(await setUserStatus("admin", sue.id, "ACTIVE", "")).toBe(true);
    await expect(auth.api.signInEmail({ body: { email: "sue@example.com", password: "Long-enough-pass-1" } })).resolves.toBeTruthy();
    const log = await db.auditLog.findMany({ where: { entityId: sue.id }, orderBy: { createdAt: "asc" } });
    expect(log.map((l) => l.action)).toEqual(["user.suspend", "user.reactivate"]);
  });
});

describe("staff sidebar numbers", () => {
  it("one query gives the same counts as the separate ones", async () => {
    await db.notification.createMany({ data: [{ userId: "admin", kind: "x", data: {} }, { userId: "admin", kind: "x", data: {}, readAt: NOW }, { userId: "g1", kind: "x", data: {} }] });
    await db.supportTicket.create({ data: { reference: "HL-ABC234", userId: "g1", category: "OTHER", subject: "Help" } });
    // Waiting for staff: the guest wrote last. Answered: staff wrote last. Read: staff read after the guest wrote.
    const waiting = await db.conversation.create({ data: { listingId: "flat", guestId: "g1", hostId: "host" } });
    await db.message.create({ data: { conversationId: waiting.id, senderId: "g1", body: "Hello" } });
    await db.user.create({ data: { id: "g2", name: "Ann", email: "ann@example.com" } });
    const answered = await db.conversation.create({ data: { listingId: "flat", guestId: "g2", hostId: "host" } });
    await db.message.create({ data: { conversationId: answered.id, senderId: "g2", body: "Hi", createdAt: new Date("2026-10-01T08:00:00Z") } });
    await db.message.create({ data: { conversationId: answered.id, senderId: "admin", body: "Hello", createdAt: new Date("2026-10-01T09:00:00Z") } });
    await db.user.create({ data: { id: "g3", name: "Bo", email: "bo@example.com" } });
    const read = await db.conversation.create({ data: { listingId: "flat", guestId: "g3", hostId: "host", hostReadAt: new Date("2026-10-02T00:00:00Z") } });
    await db.message.create({ data: { conversationId: read.id, senderId: "g3", body: "Hi", createdAt: new Date("2026-10-01T08:00:00Z") } });

    const admin = { id: "admin", role: "ADMIN" as const };
    const [badges, counts, unread, chats, laundry] = await Promise.all([adminBadges("admin"), attentionCounts(), unreadCount("admin"), unreadChats(admin), laundryToHandle()]);
    expect(badges).toMatchObject({ ...counts, unread, messages: chats, laundry, orders: 0 });
    expect(badges.unread).toBe(1);
    expect(badges.tickets).toBe(1);
    expect(badges.messages).toBe(1);
  });
});

describe("overview numbers", () => {
  it("counts this month against last month", async () => {
    const now = new Date("2026-10-15T08:00:00Z");
    await db.ledgerEntry.createMany({
      data: [
        { kind: "GUEST_PAYMENT", amount: 100000, createdAt: new Date("2026-10-05T08:00:00Z") },
        { kind: "GUEST_PAYMENT", amount: 40000, createdAt: new Date("2026-09-20T08:00:00Z") },
        { kind: "COMMISSION", amount: 9000, createdAt: new Date("2026-10-05T08:00:00Z") },
        { kind: "GUEST_FEE", amount: 3000, createdAt: new Date("2026-10-06T08:00:00Z") },
        { kind: "HOST_PAYABLE", amount: 70000, createdAt: new Date("2026-10-06T08:00:00Z") },
      ],
    });
    await db.user.updateMany({ data: { createdAt: new Date("2026-10-02T08:00:00Z") } });
    await db.user.update({ where: { id: "g1" }, data: { createdAt: new Date("2026-09-02T08:00:00Z") } });
    const stats = await dashboardStats(now);
    expect(stats.kpis.paid).toEqual({ value: 100000, previous: 40000 });
    expect(stats.kpis.platform).toEqual({ value: 12000, previous: 0 });
    expect(stats.kpis.newUsers).toEqual({ value: 2, previous: 1 });
    expect(stats.kpis.bookings).toEqual({ value: 0, previous: 0 });
    expect(stats.liveListings).toBe(1);
    expect(stats.bookingsPerDay).toHaveLength(30);
  });
});

describe("staff areas", () => {
  it("super admins give managers services; the session carries them; services and notices follow them", async () => {
    await db.user.update({ where: { id: "admin" }, data: { role: "SUPER_ADMIN" } });
    await auth.api.signUpEmail({ body: { name: "Lin", email: "lin@example.com", password: "Long-enough-pass-1" } });
    const lin = await db.user.findUniqueOrThrow({ where: { email: "lin@example.com" } });

    // Only managers carry services, and only a super admin sets them (never their own).
    expect(await setStaffAreas("admin", lin.id, ["laundry"])).toBe(false);
    expect(await setUserRole("admin", lin.id, "MANAGER")).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { id: lin.id } })).staffAreas).toEqual([]);
    expect(await setStaffAreas("admin", lin.id, ["laundry", "nonsense", "food"])).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { id: lin.id } })).staffAreas).toEqual(["food", "laundry"]);
    expect(await setStaffAreas(lin.id, "admin", ["laundry"])).toBe(false);
    expect(await setStaffAreas("admin", "admin", [])).toBe(false);

    await db.user.update({ where: { id: lin.id }, data: { emailVerified: true } });
    // The signed-in session knows the areas, so every check sees them.
    const { headers } = await auth.api.signInEmail({ body: { email: "lin@example.com", password: "Long-enough-pass-1" }, returnHeaders: true });
    const cookie = headers.get("set-cookie")!.split(";")[0]!;
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    expect(session?.user.staffAreas).toEqual(["food", "laundry"]);

    // An admin without laundry can't move laundry orders (the check runs before the order is even looked up).
    const noLaundry = { id: lin.id, role: "MANAGER", staffAreas: ["food"] };
    expect(await moveLaundry(noLaundry, "LD-ABC234", "PICKED_UP")).toEqual({ ok: false, error: "notAllowed" });
    const withLaundry = { ...noLaundry, staffAreas: ["laundry"] };
    expect(await moveLaundry(withLaundry, "LD-ABC234", "PICKED_UP")).toEqual({ ok: false, error: "notFound" });

    // Staff notices: a food manager gets food notices, not laundry ones; admins get both.
    expect(await setStaffAreas("admin", lin.id, ["food"])).toBe(true);
    await notifyAdmins(db, "orderNew", { reference: "OR-ABC234" }, null);
    await notifyAdmins(db, "laundryRequested", { reference: "LD-ABC234" }, null);
    expect((await db.notification.findMany({ where: { userId: lin.id }, select: { kind: true } })).map((n) => n.kind)).toEqual(["orderNew"]);
    expect(await db.notification.count({ where: { userId: "admin", kind: { in: ["orderNew", "laundryRequested"] } } })).toBe(2);

    // Back to customer: areas are cleared.
    expect(await setUserRole("admin", lin.id, "USER")).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { id: lin.id } })).staffAreas).toEqual([]);
  });
});

describe("managing accounts", () => {
  it("deletes only accounts without history, never your own; sends reset links; only staff who manage staff", async () => {
    await db.user.update({ where: { id: "admin" }, data: { role: "SUPER_ADMIN" } });
    await db.user.create({ data: { id: "empty", name: "New", email: "new@example.com" } });
    await db.user.create({ data: { id: "helper", name: "Helper", email: "helper@example.com", role: "MANAGER", staffAreas: ["settings"] } });
    await createBooking({ guestId: "g1", listingId: "flat", checkIn: "2026-10-20", checkOut: "2026-10-22", guests: 1, payment: pay }, NOW);

    expect(await deleteUser("admin", "admin")).toEqual({ ok: false, error: "self" });
    expect(await deleteUser("admin", "g1")).toEqual({ ok: false, error: "hasHistory" });
    expect(await deleteUser("admin", "host")).toEqual({ ok: false, error: "hasHistory" }); // owns a place
    expect(await deleteUser("helper", "empty")).toEqual({ ok: false, error: "notAllowed" });
    expect(await deleteUser("admin", "empty")).toEqual({ ok: true });
    expect(await db.user.findUnique({ where: { id: "empty" } })).toBeNull();
    expect(await db.auditLog.count({ where: { action: "user.delete", entityId: "empty" } })).toBe(1);

    expect(await sendPasswordReset("helper", "g1", "/en/reset-password")).toEqual({ ok: false, error: "notAllowed" });
    expect(await sendPasswordReset("admin", "admin", "/en/reset-password")).toEqual({ ok: false, error: "self" });
    expect(await sendPasswordReset("admin", "g1", "/en/reset-password")).toEqual({ ok: true });
    expect(await db.auditLog.count({ where: { action: "user.passwordReset", entityId: "g1" } })).toBe(1);
  });
});

describe("deleting places and promo codes", () => {
  it("deletes only what was never used; booked places and used codes stay", async () => {
    const admin = { id: "admin", role: "ADMIN" };
    await db.listing.create({ data: { id: "spare", hostId: "host", title: "Spare flat", description: "x", type: "APARTMENT", status: "DRAFT", addressLine: "KG 2", district: "Gasabo", city: "Kigali", lat: -1.95, lng: 30.06, sizeM2: 40, rooms: 1, bedrooms: 1, bathrooms: 1, maxGuests: 2 } });
    await createBooking({ guestId: "g1", listingId: "flat", checkIn: "2026-10-20", checkOut: "2026-10-22", guests: 1, payment: pay }, NOW);
    expect(await deletePlace({ id: "host" }, "spare")).toEqual({ ok: false, error: "notAllowed" });
    expect(await deletePlace(admin, "flat")).toEqual({ ok: false, error: "hasBookings" });
    expect(await deletePlace(admin, "spare")).toEqual({ ok: true });
    expect(await db.listing.findUnique({ where: { id: "spare" } })).toBeNull();

    const promo = await db.promoCode.create({ data: { code: "FRESH10", percentOff: 10, createdById: "admin" } });
    await db.promoCode.update({ where: { id: promo.id }, data: { usedCount: 1 } });
    expect(await deletePromo("admin", promo.id)).toEqual({ ok: false, error: "used" });
    await db.promoCode.update({ where: { id: promo.id }, data: { usedCount: 0 } });
    expect(await deletePromo("admin", promo.id)).toEqual({ ok: true });
    expect(await db.promoCode.count()).toBe(0);
  });
});

describe("making someone a place owner", () => {
  it("staff turn it on and off; never for themselves; not off while they own places", async () => {
    const { setHostAccess } = await import("./service");
    const admin = { id: "admin", role: "ADMIN" };
    expect(await setHostAccess({ id: "g1" }, "g1", true)).toEqual({ ok: false, error: "notAllowed" });
    expect(await setHostAccess(admin, "admin", true)).toEqual({ ok: false, error: "notAllowed" });
    expect(await setHostAccess(admin, "g1", true)).toEqual({ ok: true });
    expect((await db.user.findUnique({ where: { id: "g1" } }))?.isHost).toBe(true);
    expect(await setHostAccess(admin, "g1", false)).toEqual({ ok: true });
    expect((await db.user.findUnique({ where: { id: "g1" } }))?.isHost).toBe(false);
    // "host" owns the test place.
    await db.user.update({ where: { id: "host" }, data: { isHost: true } });
    expect(await setHostAccess(admin, "host", false)).toEqual({ ok: false, error: "hasPlaces" });
    expect(await db.auditLog.count({ where: { action: { in: ["user.hostOn", "user.hostOff"] } } })).toBe(2);
  });
});

describe("opening an account for someone", () => {
  it("staff open it (no password anyone knows), never twice for one email; others can't", async () => {
    const { createAccountForPerson } = await import("./service");
    const admin = { id: "admin", role: "ADMIN" };
    expect(await createAccountForPerson({ id: "g1" }, { name: "Jean", email: "jean@example.com" }, "/en/reset-password")).toEqual({ ok: false, error: "notAllowed" });
    expect(await createAccountForPerson(admin, { name: "J", email: "bad" }, "/en/reset-password")).toEqual({ ok: false, error: "invalid" });
    const made = await createAccountForPerson(admin, { name: "Jean Owner", email: "Jean@Example.com", phone: "0788 111 222" }, "/en/reset-password");
    expect(made).toMatchObject({ ok: true, person: { name: "Jean Owner", email: "jean@example.com", phone: "0788 111 222" } });
    const account = await db.account.findFirst({ where: { user: { email: "jean@example.com" } } });
    expect(account?.providerId).toBe("credential");
    expect(account?.password).toBeTruthy();
    expect(await createAccountForPerson(admin, { name: "Jean Again", email: "jean@example.com" }, "/en/reset-password")).toEqual({ ok: false, error: "exists" });
    expect(await db.auditLog.count({ where: { action: "user.createdByStaff" } })).toBe(1);
  });
});

describe("one role per person", () => {
  const admin = { id: "admin", role: "ADMIN" };
  const me = () => db.user.findUniqueOrThrow({ where: { id: "g1" }, include: { placeMembers: true, restaurantRoles: true } });

  it("switching replaces the role they had", async () => {
    const { setPersonRole } = await import("./service");
    await db.user.update({ where: { id: "g1" }, data: { status: "ACTIVE" } });
    expect(await setPersonRole({ id: "g1" }, "g1", "STAFF_ADMIN")).toEqual({ ok: false, error: "notAllowed" });
    expect(await setPersonRole(admin, "admin", "CUSTOMER")).toEqual({ ok: false, error: "notAllowed" });

    expect(await setPersonRole(admin, "g1", "STAFF_MANAGER")).toEqual({ ok: true });
    expect((await me()).role).toBe("MANAGER");
    // Receptionist at a place: no longer staff.
    expect(await setPersonRole(admin, "g1", "PLACE_RECEPTIONIST", "new")).toEqual({ ok: false, error: "invalid" });
    expect(await setPersonRole(admin, "g1", "PLACE_RECEPTIONIST", "flat")).toEqual({ ok: true });
    let u = await me();
    expect([u.role, u.placeMembers.map((m) => m.role)]).toEqual(["USER", ["RECEPTIONIST"]]);
    // Restaurant owner who will set one up: no longer at the place.
    expect(await setPersonRole(admin, "g1", "RESTAURANT_OWNER")).toEqual({ ok: true });
    u = await me();
    expect([u.isRestaurateur, u.placeMembers.length]).toEqual([true, 0]);
    expect(await setPersonRole(admin, "g1", "CUSTOMER")).toEqual({ ok: true });
    u = await me();
    expect([u.role, u.isHost, u.isRestaurateur, u.placeMembers.length, u.restaurantRoles.length]).toEqual(["USER", false, false, 0, 0]);
  });

  it("an owner given an existing place takes it over; owners keep their role until it's handed on", async () => {
    const { setPersonRole } = await import("./service");
    await db.user.update({ where: { id: "g1" }, data: { status: "ACTIVE" } });
    expect(await setPersonRole(admin, "g1", "PLACE_OWNER", "flat")).toEqual({ ok: true });
    expect((await db.listing.findUnique({ where: { id: "flat" } }))?.hostId).toBe("g1");
    expect((await me()).isHost).toBe(true);
    expect(await setPersonRole(admin, "g1", "CUSTOMER")).toEqual({ ok: false, error: "ownsPlaces" });
  });

  it("only customers book: with another role they can't, until they are a customer again", async () => {
    const { setPersonRole } = await import("./service");
    await db.user.update({ where: { id: "g1" }, data: { status: "ACTIVE" } });
    // A second place where they work the front desk.
    await db.listing.create({ data: { ...(await db.listing.findUniqueOrThrow({ where: { id: "flat" }, omit: { id: true, createdAt: true, updatedAt: true, pendingChanges: true } })), id: "hotel", title: "Hotel" } });
    const book = () => createBooking({ guestId: "g1", listingId: "flat", checkIn: "2026-10-20", checkOut: "2026-10-22", guests: 1, payment: pay }, NOW);
    expect(await setPersonRole(admin, "g1", "PLACE_RECEPTIONIST", "hotel")).toEqual({ ok: true });
    expect(await book()).toEqual({ ok: false, error: "notCustomer" });
    expect(await setPersonRole(admin, "g1", "CUSTOMER")).toEqual({ ok: true });
    expect(await book()).toMatchObject({ ok: true });
  });

  it("receptionists handle the place's laundry", async () => {
    const { canOn } = await import("@/features/places/access");
    await db.placeMember.create({ data: { listingId: "flat", userId: "g1", role: "RECEPTIONIST", addedById: "admin" } });
    expect(await canOn({ id: "g1" }, "flat", "laundry")).toBe(true);
    expect(await canOn({ id: "g1" }, "flat", "money")).toBe(false);
  });
});
