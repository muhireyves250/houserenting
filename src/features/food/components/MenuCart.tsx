"use client";

import { Bike, BedDouble, Clock, Minus, Plus, Search, ShoppingBag, Store, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { placeOrderAction } from "../actions";

type Dish = { id: string; section: string; name: string; description: string; price: number; photoUrl: string | null };
type Fulfilment = "PICKUP" | "DELIVERY" | "TO_STAY";
type Restaurant = {
  id: string;
  pickup: boolean;
  delivery: boolean;
  deliveryFee: number;
  paused: boolean;
  atYourStay: boolean;
  prepMinutes: number;
  minOrder: number;
};

const CART_KEY = (id: string) => `sr_cart_${id}`;
const field = "w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-[15px] text-ink outline-none transition-colors focus:border-primary";

/** A section's anchor id on the page. */
const sectionId = (name: string) => `menu-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "dishes"}`;

/**
 * The menu (section tabs that follow the scroll, search, dishes with photos) and the order: a side panel on
 * computers, a sheet on phones. The cart is kept in this browser; prices and fees are always worked out again on
 * the server when the order is placed.
 */
export function MenuCart({
  restaurant,
  menu,
  signedIn,
  stay,
  defaultPhone,
}: {
  restaurant: Restaurant;
  menu: Dish[];
  signedIn: boolean;
  /** The customer's stay today, when the restaurant can bring food there. */
  stay: { reference: string; label: string; free: boolean } | null;
  defaultPhone: string | null;
}) {
  const t = useTranslations("Food");
  const locale = useLocale();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const tabs = useRef<HTMLDivElement>(null);

  // Restore the cart saved in this browser (after the first paint, so server and client markup match).
  useEffect(() => {
    let saved: Record<string, number> = {};
    try {
      saved = JSON.parse(localStorage.getItem(CART_KEY(restaurant.id)) ?? "{}") as Record<string, number>;
    } catch {}
    const known = Object.fromEntries(Object.entries(saved).filter(([id, q]) => menu.some((m) => m.id === id) && q > 0));
    if (Object.keys(known).length > 0) queueMicrotask(() => setCart(known));
  }, [restaurant.id, menu]);

  const update = (id: string, delta: number) =>
    setCart((c) => {
      const next = { ...c, [id]: Math.max(0, Math.min(50, (c[id] ?? 0) + delta)) };
      if (next[id] === 0) delete next[id];
      try {
        localStorage.setItem(CART_KEY(restaurant.id), JSON.stringify(next));
      } catch {}
      return next;
    });

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groups = new Map<string, Dish[]>();
    for (const dish of menu) {
      if (q && !`${dish.name} ${dish.description} ${dish.section}`.toLowerCase().includes(q)) continue;
      groups.set(dish.section || t("dishes"), [...(groups.get(dish.section || t("dishes")) ?? []), dish]);
    }
    return [...groups.entries()];
  }, [menu, query, t]);

  // Section tabs follow the scroll.
  useEffect(() => {
    const els = sections.map(([name]) => document.getElementById(sectionId(name))).filter((el): el is HTMLElement => el !== null);
    if (els.length === 0 || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id);
      },
      { rootMargin: "-140px 0px -60% 0px" },
    );
    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, [sections]);
  useEffect(() => {
    tabs.current?.querySelector<HTMLElement>(`[data-tab="${active}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [active]);

  const lines = Object.entries(cart).map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
  const count = lines.reduce((sum, l) => sum + l.quantity, 0);
  const subtotal = lines.reduce((sum, l) => sum + (menu.find((m) => m.id === l.menuItemId)?.price ?? 0) * l.quantity, 0);
  const checkout = (
    <Checkout
      restaurant={restaurant}
      menu={menu}
      cart={cart}
      update={update}
      subtotal={subtotal}
      signedIn={signedIn}
      stay={stay}
      defaultPhone={defaultPhone}
    />
  );

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
      <div className="min-w-0">
        {/* Search and section tabs stay at the top while scrolling the menu. */}
        <div className="sticky top-0 z-20 -mx-4 bg-canvas/95 px-4 pt-2 pb-3 backdrop-blur-md md:top-[73px] md:mx-0 md:px-0">
          <label className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchMenu")}
              aria-label={t("searchMenu")}
              className="w-full rounded-full border border-line bg-surface py-2.5 pr-4 pl-10 text-[15px] text-ink outline-none focus:border-primary"
            />
          </label>
          {sections.length > 1 && (
            <div ref={tabs} className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {sections.map(([name]) => (
                <a
                  key={name}
                  href={`#${sectionId(name)}`}
                  data-tab={sectionId(name)}
                  className={cn(
                    "shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors",
                    active === sectionId(name) ? "bg-ink text-white" : "bg-surface text-ink ring-1 ring-line hover:ring-primary",
                  )}
                >
                  {name}
                </a>
              ))}
            </div>
          )}
        </div>

        {sections.length === 0 ? (
          <p className="py-10 text-center text-[15px] text-muted">{t("noMatch", { query })}</p>
        ) : (
          // Phones: room at the bottom so the floating order bar never hides the last dishes.
          <div className="flex flex-col gap-8 pt-2 pb-36 md:pb-0">
            {sections.map(([name, dishes]) => (
              <section key={name} id={sectionId(name)} className="scroll-mt-40 md:scroll-mt-48">
                <h2 className="mb-3 text-[19px] font-bold tracking-[-0.01em] text-ink">{name}</h2>
                <ul className="grid gap-3 lg:grid-cols-2">
                  {dishes.map((dish) => (
                    <DishCard key={dish.id} dish={dish} quantity={cart[dish.id] ?? 0} paused={restaurant.paused} onChange={(d) => update(dish.id, d)} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Computers: the order beside the menu. */}
      <aside className="hidden md:sticky md:top-24 md:block md:self-start">{checkout}</aside>

      {/* Phones: a bar that opens the order as a sheet. */}
      {count > 0 && (
        <button
          type="button"
          onClick={() => setSheet(true)}
          className="fixed inset-x-4 bottom-[calc(88px+env(safe-area-inset-bottom))] z-30 flex items-center justify-between rounded-full bg-primary px-5 py-3.5 text-[15px] font-semibold text-white shadow-[0_14px_32px_-10px_rgba(0,60,140,0.7)] md:hidden"
        >
          <span className="inline-flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-white/20 text-[13px] tabular-nums">{count}</span>
            {t("viewOrderShort")}
          </span>
          <span className="tabular-nums">{formatRWF(subtotal, locale)}</span>
        </button>
      )}
      {sheet && (
        <Modal title={t("yourOrderTitle")} closeLabel={t("close")} onClose={() => setSheet(false)} className="md:hidden">
          {checkout}
        </Modal>
      )}
    </div>
  );
}

function DishCard({ dish, quantity, paused, onChange }: { dish: Dish; quantity: number; paused: boolean; onChange: (delta: number) => void }) {
  const locale = useLocale();
  return (
    <li className={cn("flex gap-3 rounded-2xl bg-surface p-3 ring-1 transition-shadow", quantity > 0 ? "ring-primary/60 shadow-[0_8px_24px_-14px_rgba(0,87,184,0.5)]" : "ring-line")}>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold text-ink">{dish.name}</span>
        {dish.description && <span className="mt-0.5 line-clamp-2 text-[13px] text-muted">{dish.description}</span>}
        <span className="mt-auto pt-2 text-[15px] font-semibold tabular-nums text-ink">{formatRWF(dish.price, locale)}</span>
      </div>
      {dish.photoUrl ? (
        <div className="relative shrink-0">
          <div className="relative size-24 overflow-hidden rounded-xl bg-primary-soft">
            {/* eslint-disable-next-line @next/next/no-img-element -- menu photo from the restaurant's Cloudinary upload */}
            <img src={dish.photoUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
          </div>
          <span className={cn("absolute", quantity > 0 ? "-bottom-2 left-1/2 -translate-x-1/2" : "-right-1.5 -bottom-1.5")}>
            <Stepper dish={dish} quantity={quantity} paused={paused} onChange={onChange} />
          </span>
        </div>
      ) : (
        // No photo: just the control, so the card doesn't show an empty box.
        <div className="flex shrink-0 items-end">
          <Stepper dish={dish} quantity={quantity} paused={paused} onChange={onChange} />
        </div>
      )}
    </li>
  );
}

/** "+" to add a dish, then − count + once it's in the order. */
function Stepper({ dish, quantity, paused, onChange }: { dish: Dish; quantity: number; paused: boolean; onChange: (delta: number) => void }) {
  const t = useTranslations("Food");
  return quantity > 0 ? (
    <span className="flex items-center gap-1 rounded-full bg-surface p-0.5 shadow-md ring-1 ring-line">
      <button type="button" aria-label={t("less", { name: dish.name })} onClick={() => onChange(-1)} className="flex size-7 items-center justify-center rounded-full hover:bg-canvas">
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <span className="w-5 text-center text-[14px] font-bold tabular-nums">{quantity}</span>
      <button type="button" aria-label={t("more", { name: dish.name })} onClick={() => onChange(1)} className="flex size-7 items-center justify-center rounded-full bg-primary text-white">
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </span>
  ) : (
    <button
      type="button"
      disabled={paused}
      aria-label={t("addDishNamed", { name: dish.name })}
      onClick={() => onChange(1)}
      className="flex size-9 items-center justify-center rounded-full bg-primary text-white shadow-md ring-2 ring-surface transition-transform hover:scale-105 disabled:opacity-50"
    >
      <Plus className="size-5" aria-hidden="true" />
    </button>
  );
}

function Option({ on, onSelect, icon, title, detail }: { on: boolean; onSelect: () => void; icon: ReactNode; title: string; detail: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onSelect}
      className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors", on ? "border-primary bg-primary/[0.06]" : "border-line hover:border-primary/60")}
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", on ? "bg-primary text-white" : "bg-canvas text-ink")}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-ink">{title}</span>
        <span className="block text-[12px] text-muted">{detail}</span>
      </span>
    </button>
  );
}

/** The order: items (change quantities), how to get it, details, totals, and Place order. */
function Checkout({
  restaurant,
  menu,
  cart,
  update,
  subtotal,
  signedIn,
  stay,
  defaultPhone,
}: {
  restaurant: Restaurant;
  menu: Dish[];
  cart: Record<string, number>;
  update: (id: string, delta: number) => void;
  subtotal: number;
  signedIn: boolean;
  stay: { reference: string; label: string; free: boolean } | null;
  defaultPhone: string | null;
}) {
  const t = useTranslations("Food");
  const locale = useLocale();
  const router = useRouter();
  const options: Fulfilment[] = [...(stay ? (["TO_STAY"] as const) : []), ...(restaurant.pickup ? (["PICKUP"] as const) : []), ...(restaurant.delivery ? (["DELIVERY"] as const) : [])];
  const [fulfilment, setFulfilment] = useState<Fulfilment>(options[0] ?? "PICKUP");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const lines = Object.entries(cart).flatMap(([id, quantity]) => {
    const dish = menu.find((m) => m.id === id);
    return dish ? [{ dish, quantity }] : [];
  });
  const fee = fulfilment === "DELIVERY" || (fulfilment === "TO_STAY" && stay && !stay.free) ? restaurant.deliveryFee : 0;
  const short = Math.max(0, restaurant.minOrder - subtotal);
  const minutes = (f: Fulfilment) => restaurant.prepMinutes + (f === "PICKUP" || (f === "TO_STAY" && stay?.free) ? 0 : 20);
  const blocked = restaurant.paused || short > 0 || phone.trim().length < 9 || (fulfilment === "DELIVERY" && address.trim().length < 5);

  const order = () =>
    start(async () => {
      setError(null);
      if (!signedIn) {
        router.push({ pathname: "/login", query: { next: `/restaurants/${restaurant.id}` } });
        return;
      }
      const result = await placeOrderAction({
        restaurantId: restaurant.id,
        lines: lines.map((l) => ({ menuItemId: l.dish.id, quantity: l.quantity })),
        fulfilment,
        address: fulfilment === "DELIVERY" ? address : null,
        bookingReference: fulfilment === "TO_STAY" ? (stay?.reference ?? null) : null,
        phone,
        note: note || null,
      });
      if (result.ok) {
        try {
          localStorage.removeItem(CART_KEY(restaurant.id));
        } catch {}
        router.push(`/orders/${result.reference}`);
      } else setError(t(`orderError.${result.error}`));
    });

  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:p-0 max-md:shadow-none max-md:ring-0">
      <h2 className="inline-flex items-center gap-2 text-[17px] font-bold text-ink max-md:hidden">
        <ShoppingBag className="size-5 text-primary" aria-hidden="true" />
        {t("yourOrderTitle")}
      </h2>
      {restaurant.paused && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">{t("pausedNow")}</p>}

      {lines.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <ShoppingBag className="size-8 text-line-strong" aria-hidden="true" />
          <p className="text-[14px] text-muted">{t("cartEmpty")}</p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-line">
            {lines.map(({ dish, quantity }) => (
              <li key={dish.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-ink">{dish.name}</span>
                  <span className="block text-[13px] tabular-nums text-muted">{formatRWF(dish.price * quantity, locale)}</span>
                </span>
                <span className="flex items-center gap-1 rounded-full ring-1 ring-line">
                  <button type="button" aria-label={quantity === 1 ? t("removeDish", { name: dish.name }) : t("less", { name: dish.name })} onClick={() => update(dish.id, -1)} className="flex size-8 items-center justify-center rounded-full hover:bg-canvas">
                    {quantity === 1 ? <X className="size-4 text-danger" aria-hidden="true" /> : <Minus className="size-4" aria-hidden="true" />}
                  </button>
                  <span className="w-5 text-center text-[14px] font-bold tabular-nums">{quantity}</span>
                  <button type="button" aria-label={t("more", { name: dish.name })} onClick={() => update(dish.id, 1)} className="flex size-8 items-center justify-center rounded-full hover:bg-canvas">
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ul>

          <div role="radiogroup" aria-label={t("howToGet")} className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-muted">{t("howToGet")}</p>
            {options.map((o) => (
              <Option
                key={o}
                on={fulfilment === o}
                onSelect={() => setFulfilment(o)}
                icon={o === "TO_STAY" ? <BedDouble className="size-4.5" aria-hidden="true" /> : o === "PICKUP" ? <Store className="size-4.5" aria-hidden="true" /> : <Bike className="size-4.5" aria-hidden="true" />}
                title={o === "TO_STAY" && stay ? t("toStay", { place: stay.label }) : t(`fulfilment.${o}`)}
                detail={[
                  t("aboutMinutes", { minutes: minutes(o) }),
                  o === "PICKUP" || (o === "TO_STAY" && stay?.free) ? t("noFee") : formatRWF(restaurant.deliveryFee, locale),
                ].join(" · ")}
              />
            ))}
          </div>

          {fulfilment === "DELIVERY" && (
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
              {t("deliveryAddress")}
              <textarea rows={2} maxLength={200} value={address} placeholder={t("addressHint")} onChange={(e) => setAddress(e.target.value)} className={field} />
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
            {t("phone")}
            <input inputMode="tel" autoComplete="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
            {t("note")}
            <input maxLength={300} value={note} placeholder={t("noteHint")} onChange={(e) => setNote(e.target.value)} className={field} />
          </label>

          <dl className="flex flex-col gap-1.5 border-t border-line pt-3 text-[14px]">
            <div className="flex justify-between">
              <dt className="text-muted">{t("subtotal")}</dt>
              <dd className="tabular-nums">{formatRWF(subtotal, locale)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">{t("deliveryFeeLine")}</dt>
              <dd className="tabular-nums">{fee > 0 ? formatRWF(fee, locale) : t("free")}</dd>
            </div>
            <div className="flex justify-between pt-1 text-[17px] font-bold text-ink">
              <dt>{t("total")}</dt>
              <dd className="tabular-nums">{formatRWF(subtotal + fee, locale)}</dd>
            </div>
          </dl>
          {short > 0 && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">{t("addMore", { amount: formatRWF(short, locale) })}</p>}
          <p className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Clock className="size-3.5" aria-hidden="true" />
            {t("payOnDelivery")}
          </p>
          {error && (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={pending || blocked}
            onClick={order}
            className="flex items-center justify-between rounded-full bg-primary px-5 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            <span>{pending ? t("placing") : signedIn ? t("placeOrder") : t("loginToOrder")}</span>
            <span className="tabular-nums">{formatRWF(subtotal + fee, locale)}</span>
          </button>
        </>
      )}
    </div>
  );
}
