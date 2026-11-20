import { describe, expect, it } from "vitest";
import { noticeGroup } from "./categories";

describe("noticeGroup", () => {
  it("puts each kind of notice in its group", () => {
    expect(noticeGroup("bookingHeld")).toBe("bookings");
    expect(noticeGroup("bookingConfirmed")).toBe("bookings");
    expect(noticeGroup("paymentNotReceived")).toBe("bookings");
    expect(noticeGroup("stayRequestApproved")).toBe("bookings");
    expect(noticeGroup("refundSent")).toBe("bookings");
    expect(noticeGroup("orderStatus")).toBe("food");
    expect(noticeGroup("orderReceived")).toBe("food");
    expect(noticeGroup("laundryUpdate")).toBe("laundry");
    expect(noticeGroup("newMessage")).toBe("messages");
    expect(noticeGroup("ticketStatus")).toBe("help");
    expect(noticeGroup("questionAnswered")).toBe("help");
    expect(noticeGroup("promoterStatus")).toBe("money");
    expect(noticeGroup("payoutRecorded")).toBe("money");
    expect(noticeGroup("newBooking")).toBe("bookings");
    expect(noticeGroup("listingStatus")).toBe("places");
    expect(noticeGroup("somethingNew")).toBe("other");
  });
});
