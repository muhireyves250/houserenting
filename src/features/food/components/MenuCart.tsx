"use client";

import { Minus, Plus, ShoppingBag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { placeOrderAction } from "../actions";

type Dish = { id: string; section: string; name: string; description: string; price: number };
type Fulfilment = "PICKUP" | "DELIVERY" | "TO_STAY";

/**
 * The menu with a cart that stays while browsing (saved in this browser), and checkout: pickup, delivery to an
 * address, or to the customer's room when they're staying nearby. Prices are always worked out again on the server.
 */
export function MenuCart({
  restaurant,
  menu,
  signedIn,
  stay,
  defaultPhone,
}: {
  restaurant: { id: string; pickup: boolean; delivery: boolean; deliveryFee: number; paused: boolean; atYourStay: boolean };
  menu: Dish[];
  signedIn: boolean;
  /** The customer's stay today, when the restaurant can bring food there. */
  stay: { reference: string; label: string; free: boolean } | null;
  defaultPhone: string | null;
}) {
  const t = useTranslations("Food");
  const locale = useLocale();
  const router = useRouter();
  const key = `sr_cart_${restaurant.id}`;
  const [cart, setCart] = useState<Record<string, number>>({});
  const [fulfilment, setFulfilment] = useState<Fulfilment>(stay ? "TO_STAY" : restaurant.pickup ? "PICKUP" : "DELIVERY");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Restore the cart saved in this browser (after the first paint, so server and client markup match).
  useEffect(() => {
    let saved: Record<string, number> = {};
    try {
      saved = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, number>;
    } catch {}
    const known = Object.fromEntries(Object.entries(saved).filter(([id, q]) => menu.some((m) => m.id === id) && q > 0));
    if (Object.keys(known).length > 0) queueMicrotask(() => setCart(known));
  }, [key, menu]);

  const update = (id: string, delta: number) =>
    setCart((c) => {
      const next = { ...c, [id]: Math.max(0, Math.min(50, (c[id] ?? 0) + delta)) };
      if (next[id] === 0) delete next[id];
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      return next;
    });

  const sections = useMemo(() => {
    const groups = new Map<string, Dish[]>();
    for (const dish of menu) groups.set(dish.section || "", [...(groups.get(dish.section || "") ?? []), dish]);
    return [...groups.entries()];
  }, [menu]);
  const lines = Object.entries(cart).map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
  const subtotal = lines.reduce((sum, l) => sum + (menu.find((m) => m.id === l.menuItemId)?.price ?? 0) * l.quantity, 0);
  const fee = fulfilment === "DELIVERY" || (fulfilment === "TO_STAY" && stay && !stay.free) ? restaurant.deliveryFee : 0;
  const count = lines.reduce((sum, l) => sum + l.quantity, 0);

  const order = () =>
    start(async () => {
      setError(null);
      if (!signedIn) {
        router.push({ pathname: "/login", query: { next: `/restaurants/${restaurant.id}` } });
        return;
      }
      const result = await placeOrderAction({
        restaurantId: restaurant.id,
        lines,
        fulfilment,
        address: fulfilment === "DELIVERY" ? address : null,
        bookingReference: fulfilment === "TO_STAY" ? (stay?.reference ?? null) : null,
        phone,
        note: note || null,
      });
      if (result.ok) {
        try {
          localStorage.removeItem(key);
        } catch {}
        router.push("/orders");
      } else setError(t(`orderError.${result.error}`));
    });

  const options: Fulfilment[] = [...(stay ? (["TO_STAY"] as const) : []), ...(restaurant.pickup ? (["PICKUP"] as const) : []), ...(restaurant.delivery ? (["DELIVERY"] as const) : [])];

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-6">
        {sections.map(([section, dishes]) => (
          <section key={section || "menu"}>
            {section && <h2 className="mb-2 text-[17px] font-bold text-ink">{section}</h2>}
            <ul className="flex flex-col divide-y divide-line rounded-2xl bg-surface ring-1 ring-line">
              {dishes.map((dish) => (
                <li key={dish.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-ink">{dish.name}</span>
                    {dish.description && <span className="block text-[13px] text-muted">{dish.description}</span>}
                    <span className="block text-[14px] tabular-nums text-ink">{formatRWF(dish.price, locale)}</span>
                  </span>
                  {cart[dish.id] ? (
                    <span className="flex items-center gap-2">
                      <button type="button" aria-label={t("less", { name: dish.name })} onClick={() => update(dish.id, -1)} className="flex size-8 items-center justify-center rounded-full ring-1 ring-line hover:ring-primary">
                        <Minus className="size-4" aria-hidden="true" />
                      </button>
                      <span className="w-5 text-center text-[15px] font-semibold tabular-nums">{cart[dish.id]}</span>
                      <button type="button" aria-label={t("more", { name: dish.name })} onClick={() => update(dish.id, 1)} className="flex size-8 items-center justify-center rounded-full bg-primary text-white">
                        <Plus className="size-4" aria-hidden="true" />
                      </button>
                    </span>
                  ) : (
                    <button type="button" disabled={restaurant.paused} onClick={() => update(dish.id, 1)} className="rounded-full bg-primary/10 px-4 py-2 text-[13px] font-semibold text-primary hover:bg-primary/15 disabled:opacity-50">
                      {t("add")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Phones: the order sits below the menu; this bar keeps it one tap away. */}
      {count > 0 && (
        <a
          href="#checkout"
          className="fixed inset-x-4 bottom-[calc(88px+env(safe-area-inset-bottom))] z-30 flex items-center justify-between rounded-full bg-ink px-5 py-3 text-[15px] font-semibold text-white shadow-[0_12px_30px_-10px_rgba(0,20,60,0.6)] md:hidden"
        >
          <span className="inline-flex items-center gap-2">
            <ShoppingBag className="size-5" aria-hidden="true" />
            {t("viewOrder", { count })}
          </span>
          <span className="tabular-nums">{formatRWF(subtotal + fee, locale)}</span>
        </a>
      )}
      <aside id="checkout" className="scroll-mt-24 md:sticky md:top-24 md:self-start">
        <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line">
          <h2 className="inline-flex items-center gap-2 text-[17px] font-bold text-ink">
            <ShoppingBag className="size-5 text-primary" aria-hidden="true" />
            {t("yourOrder", { count })}
          </h2>
          {restaurant.paused && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">{t("pausedNow")}</p>}
          {count === 0 ? (
            <p className="text-[14px] text-muted">{t("cartEmpty")}</p>
          ) : (
            <>
              <ul className="flex flex-col gap-1 text-[14px]">
                {lines.map((l) => {
                  const dish = menu.find((m) => m.id === l.menuItemId)!;
                  return (
                    <li key={l.menuItemId} className="flex justify-between gap-2">
                      <span>
                        {l.quantity} × {dish.name}
                      </span>
                      <span className="tabular-nums">{formatRWF(dish.price * l.quantity, locale)}</span>
                    </li>
                  );
                })}
              </ul>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1 text-xs font-semibold text-muted">{t("howToGet")}</legend>
                {options.map((o) => (
                  <label key={o} className={cn("flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-[14px]", fulfilment === o ? "border-primary bg-primary/[0.05]" : "border-line")}>
                    <input type="radio" name="fulfilment" checked={fulfilment === o} onChange={() => setFulfilment(o)} className="accent-[var(--color-primary)]" />
                    {o === "TO_STAY" && stay ? t("toStay", { place: stay.label }) : t(`fulfilment.${o}`)}
                  </label>
                ))}
              </fieldset>
              {fulfilment === "DELIVERY" && (
                <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                  {t("deliveryAddress")}
                  <textarea rows={2} maxLength={200} value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-xl border border-line-strong px-3 py-2 text-[14px] text-ink outline-none focus:border-primary" />
                </label>
              )}
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                {t("phone")}
                <input inputMode="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border border-line-strong px-3 py-2 text-[14px] text-ink outline-none focus:border-primary" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                {t("note")}
                <input maxLength={300} value={note} placeholder={t("noteHint")} onChange={(e) => setNote(e.target.value)} className="w-full rounded-xl border border-line-strong px-3 py-2 text-[14px] text-ink outline-none focus:border-primary" />
              </label>
              <dl className="flex flex-col gap-1 border-t border-line pt-3 text-[14px]">
                {fee > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted">{t("deliveryFeeLine")}</dt>
                    <dd className="tabular-nums">{formatRWF(fee, locale)}</dd>
                  </div>
                )}
                <div className="flex justify-between text-[16px] font-bold">
                  <dt>{t("total")}</dt>
                  <dd className="tabular-nums">{formatRWF(subtotal + fee, locale)}</dd>
                </div>
              </dl>
              <p className="text-xs text-muted">{t("payOnDelivery")}</p>
              {error && <p role="alert" className="text-[13px] font-medium text-danger">{error}</p>}
              <button
                type="button"
                disabled={pending || restaurant.paused || phone.trim().length < 9 || (fulfilment === "DELIVERY" && address.trim().length < 5)}
                onClick={order}
                className="rounded-full bg-primary px-5 py-3 text-[15px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {signedIn ? t("placeOrder") : t("loginToOrder")}
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
