import { beforeEach, describe, expect, it } from "vitest";
import { createBooking } from "@/features/bookings/service";
import { answerQuestion, askQuestion, moderateQuestion, publishedQuestions } from "@/features/questions/service";
import { canReview, moderateReview, publishedReviews, submitReview } from "@/features/reviews/service";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createTicket, customerReply, getMyTicket, setTicketStatus, staffReply } from "./service";

beforeEach(async () => {
  await resetDb();
  await db.listing.deleteMany();
  await db.user.createMany({
    data: [
      { id: "host", name: "Host", email: "host@example.com" },
      { id: "guest", name: "Guest", email: "guest@example.com" },
      { id: "other", name: "Other", email: "other@example.com" },
      { id: "admin", name: "Admin", email: "admin@example.com", role: "ADMIN" },
    ],
  });
  await db.listing.create({
    data: {
      id: "a",
      hostId: "host",
      title: "Lake house",
      description: "Nice",
      type: "PRIVATE_HOUSE",
      status: "PUBLISHED",
      addressLine: "KG 1",
      district: "Rubavu",
      city: "Gisenyi",
      lat: -1.7,
      lng: 29.26,
      sizeM2: 80,
      rooms: 3,
      bedrooms: 2,
      bathrooms: 1,
      maxGuests: 4,
      rates: { create: [{ unit: "NIGHT", price: 60000 }] },
    },
  });
});

describe("questions and answers", () => {
  it("show publicly only after the host answers and staff publish", async () => {
    expect(await askQuestion("guest", "a", "Is there parking for two cars?")).toEqual({ ok: true });
    expect(await askQuestion("host", "a", "Asking my own place")).toEqual({ ok: false, error: "ownListing" });
    expect(await askQuestion("guest", "a", "Hi")).toEqual({ ok: false, error: "invalid" });
    const q = await db.listingQuestion.findFirstOrThrow();
    expect(await publishedQuestions("a")).toEqual([]);

    expect(await moderateQuestion("admin", q.id, true)).toBe(false); // no answer yet
    expect(await answerQuestion({ id: "other" }, q.id, "Yes")).toBe(false);
    expect(await answerQuestion({ id: "host" }, q.id, "Yes, two spaces in the yard.")).toBe(true);
    expect(await moderateQuestion("admin", q.id, true)).toBe(true);
    expect(await publishedQuestions("a")).toEqual([expect.objectContaining({ question: "Is there parking for two cars?", answer: "Yes, two spaces in the yard." })]);
    expect(await db.notification.findFirst({ where: { userId: "guest" } })).toMatchObject({ kind: "questionAnswered" });
  });

  it("limits how many unanswered questions one guest can pile up", async () => {
    for (let i = 0; i < 3; i++) expect((await askQuestion("guest", "a", `Question number ${i}`)).ok).toBe(true);
    expect(await askQuestion("guest", "a", "One more question")).toEqual({ ok: false, error: "tooMany" });
  });
});

describe("post-stay feedback", () => {
  it("is only for a finished stay, once, and counts after staff publish it", async () => {
    const booked = await createBooking(
      { guestId: "guest", listingId: "a", checkIn: "2026-11-01", checkOut: "2026-11-03", guests: 2, payment: { method: "mtn", phone: "0788123456" } },
      new Date("2026-10-14T08:00:00Z"),
    );
    const reference = booked.ok ? booked.reference : "";
    expect(await canReview("guest", reference)).toBe(false);
    expect(await submitReview("guest", reference, 5, "Lovely stay by the lake")).toEqual({ ok: false, error: "notAllowed" });

    await db.booking.update({ where: { reference }, data: { status: "COMPLETED" } });
    expect(await canReview("other", reference)).toBe(false);
    expect(await submitReview("guest", reference, 6, "Lovely stay by the lake")).toEqual({ ok: false, error: "invalid" });
    expect(await submitReview("guest", reference, 5, "Lovely stay by the lake")).toEqual({ ok: true });
    expect(await submitReview("guest", reference, 4, "Changed my mind about it")).toEqual({ ok: false, error: "notAllowed" });

    expect(await publishedReviews("a")).toEqual([]);
    const review = await db.review.findFirstOrThrow();
    expect(await moderateReview("admin", review.id, true)).toBe(true);
    expect(await db.listing.findUnique({ where: { id: "a" }, select: { ratingAvg: true, ratingCount: true } })).toEqual({ ratingAvg: 5, ratingCount: 1 });
  });
});

describe("support requests", () => {
  it("runs open → in progress → resolved → reopened by the customer → closed, with history", async () => {
    const created = await createTicket("guest", { category: "COMPLAINT", subject: "No hot water", body: "The shower is cold.", bookingReference: "SR-XXXXXX" });
    expect(created.ok).toBe(true);
    const reference = created.ok ? created.reference : "";
    expect(reference).toMatch(/^HL-/);
    // Someone else's or made-up booking codes are not attached.
    expect((await getMyTicket("guest", reference))?.bookingReference).toBeNull();
    expect(await getMyTicket("other", reference)).toBeNull();
    expect(await db.notification.count({ where: { userId: "admin", kind: "ticketOpened" } })).toBe(1);

    expect(await staffReply("admin", reference, "Sorry! The host is on the way.")).toBe(true);
    expect((await getMyTicket("guest", reference))?.status).toBe("IN_PROGRESS");
    expect(await setTicketStatus("admin", reference, "RESOLVED")).toBe(true);
    expect(await customerReply("guest", reference, "Still cold this morning.")).toBe(true);
    expect((await getMyTicket("guest", reference))?.status).toBe("OPEN");
    expect(await setTicketStatus("admin", reference, "CLOSED")).toBe(true);
    expect(await setTicketStatus("admin", reference, "OPEN")).toBe(false);
    expect(await customerReply("guest", reference, "Hello?")).toBe(false);

    const thread = await getMyTicket("guest", reference);
    expect(thread?.messages.map((m) => m.fromStaff)).toEqual([false, true, false]);
    const history = await db.auditLog.findMany({ where: { entityId: reference }, orderBy: { createdAt: "asc" } });
    expect(history.map((h) => h.action)).toEqual(["ticket.open", "ticket.reply", "ticket.status", "ticket.status", "ticket.status"]);
  });
});
