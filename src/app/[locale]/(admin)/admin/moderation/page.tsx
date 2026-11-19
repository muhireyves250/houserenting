import { House, MessageCircleQuestion, Star, User } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { adminCard, Group, StatTiles } from "@/features/admin/components/kit";
import { ModerateButtons } from "@/features/admin/components/StaffButtons";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { AnswerQuestion } from "@/features/questions/components/AnswerQuestion";
import { pendingQuestions } from "@/features/questions/service";
import { Stars } from "@/features/reviews/components/Stars";
import { pendingReviews } from "@/features/reviews/service";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/permissions";

/** Staff check guests' questions and feedback before they show on a place: publish or reject, one card each. */
export default async function ModerationPage() {
  await requireAdmin("/admin/moderation");
  const [t, tReviews, locale, questions, reviews] = await Promise.all([getTranslations("Admin"), getTranslations("Reviews"), getLocale(), pendingQuestions(), pendingReviews()]);
  const who = (name: string, place: { id: string; title: string }, at: Date) => (
    <div className="flex flex-col gap-1 text-[13px]">
      <span className="flex items-center gap-2 text-ink">
        <House className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <Link href={`/admin/listings/${place.id}`} className="truncate font-semibold hover:text-primary">
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
    <div className="flex flex-col gap-8">
      <StatTiles
        items={[
          { label: t("questions"), count: questions.length, href: "#questions", tone: "text-primary" },
          { label: t("feedback"), count: reviews.length, href: "#feedback", tone: "text-primary" },
        ]}
      />
      <Group id="questions" title={t("questions")} count={questions.length} empty={t("nothingHere")}>
        <ul className="grid gap-3 lg:grid-cols-2">
          {questions.map((q) => (
            <li key={q.id} className={adminCard}>
              {who(q.asker.name, q.listing, q.createdAt)}
              <p className="flex items-start gap-2 text-[15px] font-semibold text-ink">
                <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                {q.question}
              </p>
              {q.answer ? (
                <p className="rounded-xl bg-canvas px-3 py-2 text-[14px] text-ink/85">{q.answer}</p>
              ) : (
                <>
                  <p className="text-[13px] font-medium text-amber-800">{t("waitingForHost")}</p>
                  <AnswerQuestion questionId={q.id} />
                </>
              )}
              <div className="border-t border-line pt-3">
                <ModerateButtons kind="question" id={q.id} canPublish={Boolean(q.answer)} />
              </div>
            </li>
          ))}
        </ul>
      </Group>
      <Group id="feedback" title={t("feedback")} count={reviews.length} empty={t("nothingHere")}>
        <ul className="grid gap-3 lg:grid-cols-2">
          {reviews.map((r) => (
            <li key={r.id} className={adminCard}>
              {who(r.author.name, r.listing, r.createdAt)}
              <span className="flex items-center gap-2">
                <Stars rating={r.rating} label={tReviews("stars", { count: r.rating })} />
                <span className="inline-flex items-center gap-1 text-[13px] font-bold text-ink">
                  <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                  {r.rating}/5
                </span>
              </span>
              {r.comment && <p className="rounded-xl bg-canvas px-3 py-2 text-[14px] text-ink">{r.comment}</p>}
              <div className="border-t border-line pt-3">
                <ModerateButtons kind="review" id={r.id} />
              </div>
            </li>
          ))}
        </ul>
      </Group>
    </div>
  );
}
