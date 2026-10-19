export type ListingStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "REJECTED"
  | "ARCHIVED"
  | "CHANGES_REQUESTED"
  | "HIDDEN"
  | "PAUSED"
  | "SUSPENDED";

export type ListingMove =
  | "submit"
  | "approve"
  | "publishDirect"
  | "requestChanges"
  | "reject"
  | "hide"
  | "unhide"
  | "pause"
  | "resume"
  | "suspend"
  | "reinstate"
  | "archive";

type Rule = { from: readonly ListingStatus[]; to: ListingStatus; who: "staff" | "owner" | "either"; reason: boolean };

/** Every way a listing's status can change, who may do it, and whether a reason (shown to the owner) is required. */
export const LISTING_MOVES: Record<ListingMove, Rule> = {
  submit: { from: ["DRAFT", "REJECTED", "CHANGES_REQUESTED"], to: "PENDING_REVIEW", who: "either", reason: false },
  approve: { from: ["PENDING_REVIEW"], to: "PUBLISHED", who: "staff", reason: false },
  // Staff creating a place themselves can publish it without the review queue.
  publishDirect: { from: ["DRAFT", "CHANGES_REQUESTED"], to: "PUBLISHED", who: "staff", reason: false },
  requestChanges: { from: ["PENDING_REVIEW", "PUBLISHED", "HIDDEN"], to: "CHANGES_REQUESTED", who: "staff", reason: true },
  reject: { from: ["PENDING_REVIEW"], to: "REJECTED", who: "staff", reason: true },
  hide: { from: ["PUBLISHED", "PAUSED"], to: "HIDDEN", who: "staff", reason: true },
  unhide: { from: ["HIDDEN"], to: "PUBLISHED", who: "staff", reason: false },
  pause: { from: ["PUBLISHED"], to: "PAUSED", who: "either", reason: false },
  resume: { from: ["PAUSED"], to: "PUBLISHED", who: "either", reason: false },
  suspend: { from: ["PUBLISHED", "HIDDEN", "PAUSED"], to: "SUSPENDED", who: "staff", reason: true },
  reinstate: { from: ["SUSPENDED"], to: "PUBLISHED", who: "staff", reason: false },
  archive: { from: ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "CHANGES_REQUESTED", "HIDDEN", "PAUSED", "SUSPENDED"], to: "ARCHIVED", who: "either", reason: false },
};

export type MoveCheck = { ok: true; to: ListingStatus } | { ok: false; error: "notAllowed" | "wrongStatus" | "reasonNeeded" };

export function checkMove(move: ListingMove, from: ListingStatus, actor: { isStaff: boolean; isOwner: boolean }, reason: string): MoveCheck {
  const rule = LISTING_MOVES[move];
  const allowed = rule.who === "staff" ? actor.isStaff : rule.who === "owner" ? actor.isOwner : actor.isStaff || actor.isOwner;
  if (!allowed) return { ok: false, error: "notAllowed" };
  if (!rule.from.includes(from)) return { ok: false, error: "wrongStatus" };
  if (rule.reason && !reason.trim()) return { ok: false, error: "reasonNeeded" };
  return { ok: true, to: rule.to };
}

/** The moves a person can make from a status (for showing the right buttons). */
export function movesFrom(from: ListingStatus, actor: { isStaff: boolean; isOwner: boolean }): ListingMove[] {
  return (Object.keys(LISTING_MOVES) as ListingMove[]).filter((move) => {
    const check = checkMove(move, from, actor, "x");
    return check.ok;
  });
}

/** Statuses guests may see a public page for (with an accurate notice); drafts and submissions don't exist publicly. */
export const PUBLIC_NOTICE_STATUSES: readonly ListingStatus[] = ["HIDDEN", "PAUSED", "SUSPENDED", "ARCHIVED", "CHANGES_REQUESTED"];
