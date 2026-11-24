import { Shirt, UtensilsCrossed } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { formatRWF } from "@/lib/format";
import type { FoodHistory, placeServices, Step } from "../services-history";
import { ConfirmAction } from "@/features/admin/components/ConfirmAction";
import { deleteFoodOrderAction } from "@/features/food/actions";

type Services = Awaited<ReturnType<typeof placeServices>>;
const LAUNDRY_STEPS = ["REQUESTED", "ACCEPTED", "PICKED_UP", "WASHED", "RETURNED", "RECEIVED", "CANCELLED"];

/**
 * Staff: the food and laundry at a place. Each order (tap to open) shows its money and every step with who did it
 * and when: the restaurant, the delivery person, the receptionist, the guest confirming; laundry collected, washed,
 * returned and received.
 */
export async function PlaceServices({ services }: { services: Services }) {
  const [t, tLaundry, locale] = await Promise.all([getTranslations("Places.services"), getTranslations("Laundry"), getLocale()]);
  const rwf = (n: number) => formatRWF(n, locale);
  const when = (d: Date) => formatKigaliDateTime(locale, d);
  const laundryStep = (s: Step) => {
    const key = s.what === "request" ? "REQUESTED" : s.what.toUpperCase();
    return LAUNDRY_STEPS.includes(key) ? tLaundry(`status.${key as "REQUESTED"}`) : s.what === "paymentclaim" ? t("paymentClaimed") : s.what === "paid" ? t("paymentConfirmed") : s.what;
  };
  const Timeline = ({ steps, label }: { steps: Step[]; label: (s: Step) => string }) => (
    <ol className="mt-2 flex flex-col gap-1.5 border-l-2 border-line pl-3">
      {steps.map((s, i) => (
        <li key={i} className="text-[13px]">
          <b className="font-semibold text-ink">{label(s)}</b>
          {s.who && <span className="text-ink"> · {t("by", { name: s.who })}</span>}
          <span className="block text-[12px] text-muted">{when(s.at)}</span>
          {s.note && !s.note.startsWith("confirmed by ") && <span className="block text-[12px] text-muted">“{s.note}”</span>}
        </li>
      ))}
    </ol>
  );

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-[15px] font-bold text-ink">
          <UtensilsCrossed className="size-4 text-primary" aria-hidden="true" />
          {t("food")} <span className="font-semibold text-muted">({services.food.length})</span>
        </h3>
        {services.food.length === 0 && <p className="text-[13px] text-muted">{t("noFood")}</p>}
        <FoodOrderList orders={services.food} />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-[15px] font-bold text-ink">
          <Shirt className="size-4 text-primary" aria-hidden="true" />
          {t("laundry")} <span className="font-semibold text-muted">({services.laundry.length})</span>
        </h3>
        {services.laundry.length === 0 && <p className="text-[13px] text-muted">{t("noLaundry")}</p>}
        {services.laundry.map((l) => (
          <details key={l.reference} className="rounded-xl bg-canvas p-3">
            <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
              <span className="font-mono font-bold text-ink">{l.reference}</span>
              <span className="rounded-full bg-surface px-2 py-0.5 font-semibold text-ink ring-1 ring-line">{tLaundry(`status.${l.status}`)}</span>
              <span className="text-muted">{l.guest}</span>
              <span className="ml-auto font-semibold text-ink tabular-nums">{l.amount !== null ? rwf(l.amount) : "—"}</span>
            </summary>
            <p className="mt-2 text-[13px] text-muted">
              {l.kg !== null ? t("weighed", { kg: l.kg.toLocaleString(locale, { maximumFractionDigits: 2 }) }) : t("notWeighed")} · {l.paidAt ? t("paidAt", { when: when(l.paidAt) }) : t("notPaid")}
            </p>
            <Timeline steps={l.steps} label={laundryStep} />
          </details>
        ))}
      </section>
    </div>
  );
}

/**
 * Food orders, each opening to: what was ordered; the money (guest paid, VIIPA, restaurant, when paid); the people
 * (guest, restaurant, delivery person, receptionist); and a timeline of every step in plain words, with who and when.
 * Staff may delete a cancelled, unpaid one (`deletable`).
 */
export async function FoodOrderList({ orders, deletable = false }: { orders: FoodHistory[]; deletable?: boolean }) {
  const [t, tFood, locale] = await Promise.all([getTranslations("Places.services"), getTranslations("Food"), getLocale()]);
  const rwf = (n: number) => formatRWF(n, locale);
  const when = (d: Date) => formatKigaliDateTime(locale, d);
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" });
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "Africa/Kigali" });
  // One step in plain words.
  const sentence = (s: Step) => {
    if (s.what.startsWith("CONFIRMED:")) return s.what.slice(10).split(",").map((w) => t(`said.${w as "guest"}`)).join(" · ");
    if (s.what === "COURIER_ASSIGNED") return t("step.COURIER_ASSIGNED", { name: s.note ?? "?" });
    return dynamicStep(s.what);
  };
  const KNOWN = ["PLACED", "ACCEPTED", "PAID", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "FINISHED", "REJECTED", "CANCELLED", "TIMED_OUT", "DELIVERY_FAILED"];
  const dynamicStep = (what: string) => (KNOWN.includes(what) ? t(`step.${what as "PLACED"}`) : what);
  const box = "flex flex-col gap-1 rounded-xl bg-surface p-3 ring-1 ring-line";
  const head = "text-[11px] font-bold tracking-[0.06em] text-muted uppercase";

  return (
    <ul className="flex flex-col gap-2">
      {orders.map((o) => (
        <li key={o.reference}>
          <details className="group rounded-2xl bg-canvas ring-1 ring-line open:bg-surface open:shadow-sm">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-3 text-[13px]">
              <span className="font-mono text-[14px] font-bold text-ink">{o.reference}</span>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[12px] font-semibold text-primary">{tFood(`status.${o.status}`)}</span>
              <span className="min-w-0 flex-1 truncate text-ink">
                <b className="font-semibold">{o.restaurant}</b> <span className="text-muted">→</span> {o.guest}
              </span>
              <span className="text-muted">{when(o.createdAt)}</span>
              <span className="font-bold text-ink tabular-nums">{rwf(o.total)}</span>
              <span className="text-[12px] font-semibold text-primary group-open:hidden">{t("open")}</span>
            </summary>

            <div className="flex flex-col gap-3 border-t border-line p-3.5">
              {o.address && <p className="text-[13px] text-muted">{t("deliverTo", { place: o.address })}</p>}
              <div className="grid gap-2 md:grid-cols-3">
                <div className={box}>
                  <span className={head}>{t("what")}</span>
                  {o.items.map((i, n) => (
                    <span key={n} className="text-[14px] text-ink">
                      <b className="font-semibold tabular-nums">{i.quantity} ×</b> {i.name}
                    </span>
                  ))}
                </div>
                <div className={box}>
                  <span className={head}>{t("moneyTitle")}</span>
                  <span className="flex justify-between text-[14px]">
                    {t("guestPaid")} <b className="tabular-nums">{rwf(o.total)}</b>
                  </span>
                  <span className="flex justify-between text-[13px] text-muted">
                    {t("viipa")} <span className="tabular-nums">{rwf(o.commission)}</span>
                  </span>
                  <span className="flex justify-between text-[13px] text-muted">
                    {t("restaurantShare")} <span className="tabular-nums">{rwf(o.share)}</span>
                  </span>
                  <span className={o.paidAt ? "text-[12px] font-medium text-emerald-700" : "text-[12px] font-medium text-amber-800"}>{o.paidAt ? t("paidAt", { when: when(o.paidAt) }) : t("notPaid")}</span>
                </div>
                <div className={box}>
                  <span className={head}>{t("people")}</span>
                  <span className="text-[13px]">
                    <span className="text-muted">{t("p.guest")}</span> <b className="font-semibold text-ink">{o.guest}</b>
                  </span>
                  <span className="text-[13px]">
                    <span className="text-muted">{t("p.restaurant")}</span> <b className="font-semibold text-ink">{o.restaurant}</b>
                  </span>
                  <span className="text-[13px]">
                    <span className="text-muted">{t("p.courier")}</span> <b className="font-semibold text-ink">{o.courier ?? t("kitchenItself")}</b>
                  </span>
                  {o.confirmed.deskBy && (
                    <span className="text-[13px]">
                      <span className="text-muted">{t("p.desk")}</span> <b className="font-semibold text-ink">{o.confirmed.deskBy}</b>
                    </span>
                  )}
                  <span className={o.confirmed.guest ? "text-[12px] font-medium text-emerald-700" : "text-[12px] font-medium text-amber-800"}>{o.confirmed.guest ? t("guestGot", { when: when(o.confirmed.guest) }) : t("guestNotYet")}</span>
                </div>
              </div>
              {o.cancelReason && <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-800">{t("why", { reason: o.cancelReason })}</p>}

              {/* Every step in plain words: who, and when. */}
              <div className={box}>
                <span className={head}>{t("timeline")}</span>
                <ol className="mt-1 flex flex-col">
                  {o.steps.map((s, i) => {
                    const last = i === o.steps.length - 1;
                    return (
                      <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
                        {!last && <span aria-hidden="true" className="absolute top-3 left-[5px] h-full w-0.5 bg-line" />}
                        <span aria-hidden="true" className={`relative mt-1 size-3 shrink-0 rounded-full ring-2 ring-surface ${s.what.startsWith("CONFIRMED") || s.what === "DELIVERED" || s.what === "FINISHED" ? "bg-emerald-500" : s.what === "REJECTED" || s.what === "CANCELLED" || s.what === "DELIVERY_FAILED" || s.what === "TIMED_OUT" ? "bg-danger" : "bg-primary"}`} />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                            <b className="text-[14px] font-semibold text-ink">{sentence(s)}</b>
                            <span className="text-[12px] text-muted tabular-nums">
                              {day.format(s.at)} · {time.format(s.at)}
                            </span>
                          </span>
                          {s.who && <span className="block text-[12px] text-muted">{t("by", { name: s.who })}</span>}
                          {s.note && s.what !== "COURIER_ASSIGNED" && <span className="block text-[12px] text-muted">“{s.note}”</span>}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {deletable && o.status === "CANCELLED" && !o.paidAt && (
                <div>
                  <ConfirmAction label={tFood("staffOrders.delete")} question={tFood("staffOrders.deleteQuestion")} action={deleteFoodOrderAction.bind(null, o.reference)} />
                </div>
              )}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
