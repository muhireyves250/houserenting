import { CalendarDays, Plus, TicketPercent } from "lucide-react";
import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Chip, FillScreen } from "@/features/admin/components/kit";
import { PromoForm, PromoToggle } from "@/features/admin/components/PromoForm";
import { listPromos } from "@/features/promotions/service";
import { allPromoters } from "@/features/promoters/service";
import { ConfirmAction } from "@/features/admin/components/ConfirmAction";
import { deletePromoAction } from "@/features/admin/money-actions";
import { formatRWF } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Link } from "@/i18n/navigation";

type State = "active" | "off" | "expired" | "usedUp" | "scheduled";
const STATE_TONE: Record<State, string> = {
  active: "bg-emerald-50 text-emerald-800",
  off: "bg-canvas text-ink/70",
  expired: "bg-canvas text-ink/70",
  usedUp: "bg-amber-50 text-amber-900",
  scheduled: "bg-primary/10 text-primary",
};

/** Promo codes: the new-code form beside the list; each code a card with what it gives, who pays and how far it's used. */
export async function PromotionsView({
  tabs,
  forPromoter,
}: {
  tabs: ReactNode;
  forPromoter?: string;
}) {
  const [t, locale, promos, promoterRows] = await Promise.all([
    getTranslations("Promotions"),
    getLocale(),
    listPromos(),
    allPromoters(),
  ]);
  // Active promoters a new code can be given to (optional).
  const promoters = promoterRows
    .filter((p) => p.status === "ACTIVE")
    .map((p) => ({ id: p.id, name: p.user.name, code: p.code }));
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "Africa/Kigali",
  });
  const now = new Date();
  const stateOf = (p: (typeof promos)[number]): State =>
    !p.active
      ? "off"
      : p.endsAt && p.endsAt < now
        ? "expired"
        : p.maxUses !== null && p.usedCount >= p.maxUses
          ? "usedUp"
          : p.startsAt && p.startsAt > now
            ? "scheduled"
            : "active";
  const activeCount = promos.filter((p) => stateOf(p) === "active").length;

  return (
    <FillScreen>
      {tabs}
      {/* Computers: the new-code form beside the list, each scrolling in its own box. Phones: the form folds away. */}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-4 lg:grid-cols-[400px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
        <details
          open={Boolean(forPromoter)}
          className="group no-scrollbar max-h-[70dvh] shrink-0 overflow-y-auto rounded-2xl bg-surface ring-1 ring-line lg:hidden"
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[15px] font-semibold text-primary [&::-webkit-details-marker]:hidden">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-white">
              <Plus
                className="size-4 transition-transform group-open:rotate-45"
                aria-hidden="true"
              />
            </span>
            {t("newCode")}
          </summary>
          <div className="border-t border-line p-3">
            <PromoForm promoters={promoters} initialPromoter={forPromoter} />
          </div>
        </details>
        <div className="no-scrollbar hidden min-h-0 overflow-y-auto lg:block">
          <PromoForm promoters={promoters} initialPromoter={forPromoter} />
        </div>

        <section className="flex min-h-0 flex-col gap-3">
          <p className="shrink-0 text-[13px] font-semibold text-muted">
            {t("codesCount", { count: promos.length, active: activeCount })}
          </p>
          <ul className="no-scrollbar flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain p-1 pb-3">
            {promos.length === 0 && (
              <li className="flex flex-col items-center gap-2 rounded-2xl bg-surface py-12 text-center ring-1 ring-line">
                <TicketPercent
                  className="size-8 text-line-strong"
                  aria-hidden="true"
                />
                <span className="text-[14px] text-muted">{t("none")}</span>
              </li>
            )}
            {promos.map((p) => {
              const state = stateOf(p);
              const live = state === "active";
              const value = p.percentOff
                ? `${p.percentOff}%`
                : formatRWF(p.amountOff ?? 0, locale);
              const used = p.maxUses
                ? Math.min(100, Math.round((p.usedCount / p.maxUses) * 100))
                : null;
              return (
                <li
                  key={p.id}
                  className="flex min-w-0 flex-col gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line"
                >
                  <div className="flex items-start gap-3">
                    {/* The code, like a ticket. */}
                    <span
                      className={cn(
                        "shrink-0 rounded-xl border-2 border-dashed px-3 py-2 font-mono text-[15px] font-bold tracking-wide",
                        live
                          ? "border-primary/40 bg-primary/[0.06] text-primary"
                          : "border-line-strong bg-canvas text-muted",
                      )}
                    >
                      {p.code}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-[18px] leading-6 font-bold",
                          live ? "text-ink" : "text-muted",
                        )}
                      >
                        {t("offLabel", { value })}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        <Chip tone={STATE_TONE[state]}>
                          {t(`state.${state}`)}
                        </Chip>
                        {/* Every code has an owner: a promoter, or VIIPA (the admin's own code, followed the same way). */}
                        {p.promoter ? (
                          <Chip tone="bg-primary/10 text-primary">
                            {t("promoterOf", { name: p.promoter.user.name })}
                            {p.promoterBps ? ` · ${p.promoterBps / 100}%` : ""}
                          </Chip>
                        ) : (
                          <Chip tone="bg-ink/[0.06] text-ink">{t("viipaCode")}</Chip>
                        )}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1.5">
                      <PromoToggle id={p.id} active={p.active} />
                      {/* Never used: it can be deleted (used codes stay on record). */}
                      {p.usedCount === 0 && (
                        <ConfirmAction
                          label={t("delete")}
                          question={t("deleteQuestion", { code: p.code })}
                          action={deletePromoAction.bind(null, p.id)}
                          errors={{ used: t("deleteUsed") }}
                        />
                      )}
                    </span>
                  </div>

                  {/* How far it's used. */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3 text-[12px]">
                      <span className="font-semibold text-ink">
                        {t("uses", {
                          used: p.usedCount,
                          max: p.maxUses ?? "∞",
                        })}
                      </span>
                      {(p.endsAt || p.startsAt) && (
                        <span className="inline-flex items-center gap-1 text-muted">
                          <CalendarDays
                            className="size-3.5"
                            aria-hidden="true"
                          />
                          {p.endsAt
                            ? t("until", { date: date.format(p.endsAt) })
                            : t("startsOn", { date: date.format(p.startsAt!) })}
                        </span>
                      )}
                    </div>
                    {used !== null && (
                      <div
                        className="h-1.5 overflow-hidden rounded-full bg-canvas"
                        aria-hidden="true"
                      >
                        <div
                          className={cn(
                            "h-full rounded-full",
                            live ? "bg-primary" : "bg-line-strong",
                          )}
                          style={{ width: `${Math.max(used, 2)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  {p.description && (
                    <p className="rounded-xl bg-canvas px-3 py-2 text-[13px] text-ink/80">
                      {p.description}
                    </p>
                  )}
                  {/* Who owns it, every client who booked with it, and the rewards. */}
                  <Link
                    href={`/admin/promotions/codes/${p.id}`}
                    className="self-start text-[13px] font-semibold text-primary hover:underline"
                  >
                    {t("open")} →
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </FillScreen>
  );
}
