import "server-only";
import { audit } from "@/features/audit/service";
import { notify, notifyAdmins } from "@/features/notifications/service";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

export const QUESTION_MAX = 500;
const MAX_WAITING_PER_LISTING = 3;

export type AskResult = { ok: true } | { ok: false; error: "invalid" | "notFound" | "ownListing" | "tooMany" };

/** A guest asks about a place. Nothing shows publicly until the host answers and staff publish it. */
export async function askQuestion(userId: string, listingId: string, text: string): Promise<AskResult> {
  const question = text.trim();
  if (question.length < 5 || question.length > QUESTION_MAX) return { ok: false, error: "invalid" };
  const listing = await db.listing.findFirst({ where: { id: listingId, status: "PUBLISHED" }, select: { hostId: true, title: true } });
  if (!listing) return { ok: false, error: "notFound" };
  if (listing.hostId === userId) return { ok: false, error: "ownListing" };
  const waiting = await db.listingQuestion.count({ where: { askerId: userId, listingId, status: "PENDING" } });
  if (waiting >= MAX_WAITING_PER_LISTING) return { ok: false, error: "tooMany" };
  await db.$transaction(async (tx) => {
    await tx.listingQuestion.create({ data: { listingId, askerId: userId, question } });
    await notify(tx, listing.hostId, "questionAsked", { title: listing.title }, "/host#questions");
  });
  return { ok: true };
}

/** The listing's host (or staff) writes the answer; staff still publish it. */
export async function answerQuestion(actor: { id: string; role?: string | null }, questionId: string, text: string): Promise<boolean> {
  const answer = text.trim();
  if (answer.length < 1 || answer.length > 1000) return false;
  return db.$transaction(async (tx) => {
    const q = await tx.listingQuestion.findFirst({
      where: { id: questionId, status: "PENDING" },
      select: { listing: { select: { hostId: true, title: true } } },
    });
    if (!q || (q.listing.hostId !== actor.id && !isAdmin(actor))) return false;
    await tx.listingQuestion.update({ where: { id: questionId }, data: { answer, answeredById: actor.id, answeredAt: new Date() } });
    await audit(tx, { actorId: actor.id, action: "question.answer", entityType: "question", entityId: questionId });
    await notifyAdmins(tx, "questionToCheck", { title: q.listing.title }, "/admin/moderation");
    return true;
  });
}

/** Staff publish an answered question (the asker is told) or reject it. */
export async function moderateQuestion(adminId: string, questionId: string, publish: boolean): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const q = await tx.listingQuestion.findFirst({
      where: { id: questionId, status: "PENDING" },
      select: { answer: true, askerId: true, listingId: true, listing: { select: { title: true } } },
    });
    if (!q || (publish && !q.answer)) return false;
    await tx.listingQuestion.update({ where: { id: questionId }, data: { status: publish ? "PUBLISHED" : "REJECTED" } });
    await audit(tx, { actorId: adminId, action: publish ? "question.publish" : "question.reject", entityType: "question", entityId: questionId });
    if (publish) await notify(tx, q.askerId, "questionAnswered", { title: q.listing.title }, `/listings/${q.listingId}#questions`);
    return true;
  });
}

export function publishedQuestions(listingId: string) {
  return db.listingQuestion.findMany({
    where: { listingId, status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, question: true, answer: true, createdAt: true, answeredAt: true },
  });
}

/** Questions waiting for the host's answer. */
export function hostQuestions(hostId: string) {
  return db.listingQuestion.findMany({
    where: { status: "PENDING", answer: null, listing: { hostId } },
    orderBy: { createdAt: "asc" },
    select: { id: true, question: true, createdAt: true, listing: { select: { id: true, title: true } } },
  });
}

/** Moderation queue: every question not yet published or rejected. */
export function pendingQuestions() {
  return db.listingQuestion.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      question: true,
      answer: true,
      createdAt: true,
      asker: { select: { name: true } },
      listing: { select: { id: true, title: true } },
    },
  });
}
