import { getLocale, getTranslations } from "next-intl/server";
import { ModerateButtons } from "@/features/admin/components/StaffButtons";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { AnswerQuestion } from "@/features/questions/components/AnswerQuestion";
import { pendingQuestions } from "@/features/questions/service";
import { Stars } from "@/features/reviews/components/Stars";
import { pendingReviews } from "@/features/reviews/service";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/permissions";
import { PageIntro } from "@/features/admin/components/ui";

const card = "rounded-3xl bg-surface p-5 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line";

export default async function ModerationPage() {
  await requireAdmin("/admin/moderation");
  const [t, tReviews, locale, questions, reviews] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("Reviews"),
    getLocale(),
    pendingQuestions(),
    pendingReviews(),
  ]);
  return (
    <div className="flex flex-col gap-8">
      <PageIntro description={t("moderationIntro")} />
      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">{t("questions")}</h2>
        {questions.length === 0 && <p className="py-6 text-center text-[15px] text-muted">{t("nothingHere")}</p>}
        <ul className="flex flex-col gap-3">
          {questions.map((q) => (
            <li key={q.id} className={card}>
              <p className="text-[13px] text-muted">
                <Link href={`/listings/${q.listing.id}`} className="text-primary hover:underline">
                  {q.listing.title}
                </Link>{" "}
                · {q.asker.name} · {formatKigaliDateTime(locale, q.createdAt)}
              </p>
              <p className="mt-2 text-[15px] font-semibold text-ink">{q.question}</p>
              {q.answer ? (
                <p className="mt-1 border-l-2 border-primary/40 pl-3 text-[15px] text-ink/80">{q.answer}</p>
              ) : (
                <>
                  <p className="mt-1 text-[13px] text-amber-800">{t("waitingForHost")}</p>
                  <AnswerQuestion questionId={q.id} />
                </>
              )}
              <div className="mt-3">
                <ModerateButtons kind="question" id={q.id} canPublish={Boolean(q.answer)} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">{t("feedback")}</h2>
        {reviews.length === 0 && <p className="py-6 text-center text-[15px] text-muted">{t("nothingHere")}</p>}
        <ul className="flex flex-col gap-3">
          {reviews.map((r) => (
            <li key={r.id} className={card}>
              <p className="text-[13px] text-muted">
                <Link href={`/listings/${r.listing.id}`} className="text-primary hover:underline">
                  {r.listing.title}
                </Link>{" "}
                · {r.author.name} · {formatKigaliDateTime(locale, r.createdAt)}
              </p>
              <Stars rating={r.rating} label={tReviews("stars", { count: r.rating })} className="mt-2" />
              <p className="mt-1 text-[15px] text-ink">{r.comment}</p>
              <div className="mt-3">
                <ModerateButtons kind="review" id={r.id} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
