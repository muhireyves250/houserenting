import { describe, expect, it } from "vitest";
import { checkRequest, priceChangeFor, shouldAutoHide } from "./rules";

const stay = { status: "CONFIRMED", checkIn: "2026-11-10", checkOut: "2026-11-15" };
const today = "2026-11-01";

describe("checkRequest", () => {
  it("needs a paid, live stay and a reason", () => {
    expect(checkRequest({ ...stay, status: "PENDING_PAYMENT" }, { kind: "CANCEL", reason: "Plans changed" }, today)).toBe("status");
    expect(checkRequest(stay, { kind: "CANCEL", reason: " " }, today)).toBe("reason");
    expect(checkRequest(stay, { kind: "CANCEL", reason: "Plans changed" }, today)).toBeNull();
  });

  it("cancels only before check-in", () => {
    expect(checkRequest({ ...stay, status: "CHECKED_IN" }, { kind: "CANCEL", reason: "Plans changed" }, "2026-11-11")).toBe("status");
  });

  it("extends to a later day and shortens to a day inside the stay", () => {
    expect(checkRequest(stay, { kind: "EXTEND", reason: "Loving it", newCheckOut: "2026-11-15" }, today)).toBe("date");
    expect(checkRequest(stay, { kind: "EXTEND", reason: "Loving it", newCheckOut: "2026-11-18" }, today)).toBeNull();
    expect(checkRequest(stay, { kind: "SHORTEN", reason: "Work", newCheckOut: "2026-11-10" }, today)).toBe("date");
    expect(checkRequest(stay, { kind: "SHORTEN", reason: "Work", newCheckOut: "2026-11-12" }, today)).toBeNull();
    expect(checkRequest({ ...stay, status: "CHECKED_IN" }, { kind: "SHORTEN", reason: "Work", newCheckOut: "2026-11-12" }, "2026-11-13")).toBe("date");
  });

  it("transfers need a destination", () => {
    expect(checkRequest(stay, { kind: "TRANSFER", reason: "Closer to work", transferTo: "" }, today)).toBe("transferTo");
    expect(checkRequest(stay, { kind: "TRANSFER", reason: "Closer to work", transferTo: "Rusizi" }, today)).toBeNull();
  });
});

describe("priceChangeFor", () => {
  it("charges or refunds at the stay's daily rate", () => {
    const paid = { checkIn: "2026-11-10", checkOut: "2026-11-15", subtotal: 500_000 };
    expect(priceChangeFor(paid, "2026-11-17")).toBe(200_000);
    expect(priceChangeFor(paid, "2026-11-12")).toBe(-300_000);
  });
});

describe("shouldAutoHide", () => {
  it("hides at the threshold unless staff keep the place visible or the rule is off", () => {
    expect(shouldAutoHide(5, 5, false)).toBe(true);
    expect(shouldAutoHide(4, 5, false)).toBe(false);
    expect(shouldAutoHide(9, 5, true)).toBe(false);
    expect(shouldAutoHide(9, null, false)).toBe(false);
  });
});
