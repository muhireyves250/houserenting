import { describe, expect, it } from "vitest";
import { checkMove, movesFrom } from "./lifecycle";

const staff = { isStaff: true, isOwner: false };
const owner = { isStaff: false, isOwner: true };

describe("listing lifecycle", () => {
  it("only staff approve, reject, request changes, hide and suspend", () => {
    expect(checkMove("approve", "PENDING_REVIEW", owner, "")).toEqual({ ok: false, error: "notAllowed" });
    expect(checkMove("approve", "PENDING_REVIEW", staff, "")).toEqual({ ok: true, to: "PUBLISHED" });
    expect(checkMove("hide", "PUBLISHED", owner, "x")).toEqual({ ok: false, error: "notAllowed" });
  });

  it("asks for a reason the owner will read when sending back, rejecting, hiding or suspending", () => {
    expect(checkMove("requestChanges", "PENDING_REVIEW", staff, " ")).toEqual({ ok: false, error: "reasonNeeded" });
    expect(checkMove("hide", "PUBLISHED", staff, "Photos misleading")).toEqual({ ok: true, to: "HIDDEN" });
    expect(checkMove("unhide", "HIDDEN", staff, "")).toEqual({ ok: true, to: "PUBLISHED" });
  });

  it("lets owners submit, pause, resume and archive their own places", () => {
    expect(checkMove("submit", "CHANGES_REQUESTED", owner, "")).toEqual({ ok: true, to: "PENDING_REVIEW" });
    expect(checkMove("pause", "PUBLISHED", owner, "")).toEqual({ ok: true, to: "PAUSED" });
    expect(checkMove("resume", "PAUSED", owner, "")).toEqual({ ok: true, to: "PUBLISHED" });
    expect(checkMove("resume", "HIDDEN", owner, "")).toEqual({ ok: false, error: "wrongStatus" });
  });

  it("lists the buttons each person gets", () => {
    expect(movesFrom("PUBLISHED", owner)).toEqual(["pause", "archive"]);
    expect(movesFrom("PENDING_REVIEW", staff)).toEqual(["approve", "requestChanges", "reject", "archive"]);
    expect(movesFrom("ARCHIVED", staff)).toEqual([]);
  });
});
