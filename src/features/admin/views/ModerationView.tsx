import type { ReactNode } from "react";
import { House, MessageCircleQuestion, Star, User } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import {
  FillScreen,
  Group,
  ScrollArea,
  StatTiles,
  Toolbar,
  adminCard,
} from "@/features/admin/components/kit";
import { ModerateButtons } from "@/features/admin/components/StaffButtons";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { AnswerQuestion } from "@/features/questions/components/AnswerQuestion";
import {
  pendingQuestions,
  recentPublishedQuestions,
} from "@/features/questions/service";
import { Stars } from "@/features/reviews/components/Stars";
import {
  pendingReviews,
  recentPublishedReviews,
} from "@/features/reviews/service";
import { ConfirmAction } from "@/features/admin/components/ConfirmAction";
import {
  deleteModeratedAction,
  hidePublishedAction,
} from "@/features/admin/moderation-actions";
import { Link } from "@/i18n/navigation";

/** Staff check guests' questions and feedback before they show on a place: publish or reject, one card each. */
/** Guests' questions and feedback to check (and the published ones), for the Support and reviews page. */
export async function ModerationView({
  showPublished,
  tabs,
}: {
  showPublished: boolean;
  tabs: ReactNode;
}) {
  const [t, tReviews, locale, questions, reviews, doneQuestions, doneReviews] =
    await Promise.all([
      getTranslations("Admin"),
      getTranslations("Reviews"),
      getLocale(),
      pendingQuestions(),
      pendingReviews(),
      recentPublishedQuestions(),
      recentPublishedReviews(),
    ]);
  const who = (
    name: string,
    place: { id: string; title: string },
    at: Date,
  ) => (
    <div className="flex flex-col gap-1 text-[13px]">
      <span className="flex items-center gap-2 text-ink">
        <House className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <Link
          href={`/admin/listings/${place.id}`}
          className="truncate font-semibold hover:text-primary"
        >
          {place.title}
        </Link>
      </span>
      <span className="flex items-center gap-2 text-muted">
        <User className="size-4 shrink-0 text-primary" aria-hidden="true" />
        {name} · {formatKigaliDateTime(locale, at)}
      </span>
    </div>
  );
  return (
    <FillScreen>
      {tabs}
      <Toolbar>
        <StatTiles
          items={[
            {
              label: t("questions"),
              count: questions.length,
              href: { pathname: "/admin/support", query: { tab: "reviews" } },
              on: !showPublished,
              tone: "text-primary",
            },
            {
              label: t("feedback"),
              count: reviews.length,
              href: { pathname: "/admin/support", query: { tab: "reviews" } },
              on: !showPublished,
              tone: "text-primary",
            },
            {
              label: t("moderation.published"),
              count: doneQuestions.length + doneReviews.length,
              href: {
                pathname: "/admin/support",
                query: { tab: "reviews", show: "published" },
              },
              on: showPublished,
              tone: "text-emerald-700",
            },
          ]}
        />
      </Toolbar>
      <ScrollArea className="flex flex-col gap-8">
        {/* Published ones are kept: they show on the places, and can be taken down. */}
        {showPublished ? (
          <Group
            title={t("moderation.published")}
            count={doneQuestions.length + doneReviews.length}
            empty={t("moderation.publishedEmpty")}
          >
            <ul className="grid gap-3 lg:grid-cols-2">
              {doneReviews.map((r) => (
                <li key={r.id} className={adminCard}>
                  {who(r.author.name, r.listing, r.createdAt)}
                  <span className="flex items-center gap-2">
                    <Stars
                      rating={r.rating}
                      label={tReviews("stars", { count: r.rating })}
                    />
                    <span className="text-[13px] font-bold text-ink">
                      {r.rating}/5
                    </span>
                  </span>
                  {r.comment && (
                    <p className="rounded-xl bg-canvas px-3 py-2 text-[14px] text-ink">
                      {r.comment}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                    <ConfirmAction
                      label={t("moderation.hide")}
                      question={t("moderation.hideQuestion")}
                      action={hidePublishedAction.bind(null, "review", r.id)}
                    />
                    <ConfirmAction
                      label={t("moderation.delete")}
                      question={t("moderation.deleteQuestion")}
                      action={deleteModeratedAction.bind(null, "review", r.id)}
                    />
                  </div>
                </li>
              ))}
              {doneQuestions.map((q) => (
                <li key={q.id} className={adminCard}>
                  {who(q.asker.name, q.listing, q.createdAt)}
                  <p className="flex items-start gap-2 text-[15px] font-semibold text-ink">
                    <MessageCircleQuestion
                      className="mt-0.5 size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    {q.question}
                  </p>
                  {q.answer && (
                    <p className="rounded-xl bg-canvas px-3 py-2 text-[14px] text-ink/85">
                      {q.answer}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                    <ConfirmAction
                      label={t("moderation.hide")}
                      question={t("moderation.hideQuestion")}
                      action={hidePublishedAction.bind(null, "question", q.id)}
                    />
                    <ConfirmAction
                      label={t("moderation.delete")}
                      question={t("moderation.deleteQuestion")}
                      action={deleteModeratedAction.bind(
                        null,
                        "question",
                        q.id,
                      )}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Group>
        ) : (
          <>
            <Group
              id="questions"
              title={t("questions")}
              count={questions.length}
              empty={t("nothingHere")}
            >
              <ul className="grid gap-3 lg:grid-cols-2">
                {questions.map((q) => (
                  <li key={q.id} className={adminCard}>
                    {who(q.asker.name, q.listing, q.createdAt)}
                    <p className="flex items-start gap-2 text-[15px] font-semibold text-ink">
                      <MessageCircleQuestion
                        className="mt-0.5 size-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      {q.question}
                    </p>
                    {q.answer ? (
                      <p className="rounded-xl bg-canvas px-3 py-2 text-[14px] text-ink/85">
                        {q.answer}
                      </p>
                    ) : (
                      <>
                        <p className="text-[13px] font-medium text-amber-800">
                          {t("waitingForHost")}
                        </p>
                        <AnswerQuestion questionId={q.id} />
                      </>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                      <ConfirmAction
                        label={t("moderation.delete")}
                        question={t("moderation.deleteQuestion")}
                        action={deleteModeratedAction.bind(
                          null,
                          "question",
                          q.id,
                        )}
                      />
                      <ModerateButtons
                        kind="question"
                        id={q.id}
                        canPublish={Boolean(q.answer)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Group>
            <Group
              id="feedback"
              title={t("feedback")}
              count={reviews.length}
              empty={t("nothingHere")}
            >
              <ul className="grid gap-3 lg:grid-cols-2">
                {reviews.map((r) => (
                  <li key={r.id} className={adminCard}>
                    {who(r.author.name, r.listing, r.createdAt)}
                    <span className="flex items-center gap-2">
                      <Stars
                        rating={r.rating}
                        label={tReviews("stars", { count: r.rating })}
                      />
                      <span className="inline-flex items-center gap-1 text-[13px] font-bold text-ink">
                        <Star
                          className="size-3.5 fill-amber-400 text-amber-400"
                          aria-hidden="true"
                        />
                        {r.rating}/5
                      </span>
                    </span>
                    {r.comment && (
                      <p className="rounded-xl bg-canvas px-3 py-2 text-[14px] text-ink">
                        {r.comment}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                      <ConfirmAction
                        label={t("moderation.delete")}
                        question={t("moderation.deleteQuestion")}
                        action={deleteModeratedAction.bind(
                          null,
                          "review",
                          r.id,
                        )}
                      />
                      <ModerateButtons kind="review" id={r.id} />
                    </div>
                  </li>
                ))}
              </ul>
            </Group>
          </>
        )}
      </ScrollArea>
    </FillScreen>
  );
}
