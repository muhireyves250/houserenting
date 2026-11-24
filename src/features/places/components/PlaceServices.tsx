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
 * Food orders, each opening to its dishes, money (VIIPA's commission, the restaurant's share), who delivered it, who
 * received it at the desk, when the guest confirmed, and every step with who and when. Staff may delete a cancelled,
 * unpaid one (`deletable`).
 */
export async function FoodOrderList({ orders, deletable = false }: { orders: FoodHistory[]; deletable?: boolean }) {
  const [t, tFood, locale] = await Promise.all([getTranslations("Places.services"), getTranslations("Food"), getLocale()]);
  const rwf = (n: number) => formatRWF(n, locale);
  const when = (d: Date) => formatKigaliDateTime(locale, d);
  const label = (s: Step) => (s.note?.startsWith("confirmed by ") ? t("confirmedBy", { who: s.note.replace("confirmed by ", "").split(",").map((w) => t(`party.${w as "guest"}`)).join(", ") }) : tFood(`status.${s.what as "PLACED"}`));
  return (
    <ul className="flex flex-col gap-2">
      {orders.map((o) => (
        <li key={o.reference}>
          <details className="rounded-xl bg-canvas p-3">
            <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
              <span className="font-mono font-bold text-ink">{o.reference}</span>
              <span className="rounded-full bg-surface px-2 py-0.5 font-semibold text-ink ring-1 ring-line">{tFood(`status.${o.status}`)}</span>
              <span className="min-w-0 truncate text-muted">
                {o.restaurant} → {o.guest}
                {o.address && ` · ${o.address}`}
              </span>
              <span className="text-muted">{when(o.createdAt)}</span>
              <span className="ml-auto font-semibold text-ink tabular-nums">{rwf(o.total)}</span>
            </summary>
            <div className="mt-2 grid gap-2 text-[13px] sm:grid-cols-2">
              <p className="text-ink">{o.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}</p>
              <p className="text-muted">
                {o.paidAt ? t("paidAt", { when: when(o.paidAt) }) : t("notPaid")} · {t("money", { commission: rwf(o.commission), share: rwf(o.share) })}
              </p>
              <p className="text-muted">
                {t("deliveredBy", { name: o.courier ?? t("kitchenItself") })}
                {o.confirmed.desk && ` · ${t("deskTook", { name: o.confirmed.deskBy ?? "", when: when(o.confirmed.desk) })}`}
              </p>
              <p className={o.confirmed.guest ? "font-medium text-emerald-700" : "text-muted"}>{o.confirmed.guest ? t("guestGot", { when: when(o.confirmed.guest) }) : t("guestNotYet")}</p>
              {o.cancelReason && <p className="text-danger sm:col-span-2">“{o.cancelReason}”</p>}
            </div>
            <ol className="mt-2 flex flex-col gap-1.5 border-l-2 border-line pl-3">
              {o.steps.map((s, i) => (
                <li key={i} className="text-[13px]">
                  <b className="font-semibold text-ink">{label(s)}</b>
                  {s.who && <span className="text-ink"> · {t("by", { name: s.who })}</span>}
                  <span className="block text-[12px] text-muted">{when(s.at)}</span>
                  {s.note && !s.note.startsWith("confirmed by ") && <span className="block text-[12px] text-muted">“{s.note}”</span>}
                </li>
              ))}
            </ol>
            {deletable && o.status === "CANCELLED" && !o.paidAt && (
              <div className="mt-2">
                <ConfirmAction label={tFood("staffOrders.delete")} question={tFood("staffOrders.deleteQuestion")} action={deleteFoodOrderAction.bind(null, o.reference)} />
              </div>
            )}
          </details>
        </li>
      ))}
    </ul>
  );
}
