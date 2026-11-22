"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { addRestaurantMemberAction, removeRestaurantMemberAction } from "@/features/food/actions";
import { addTeamMemberAction, removeTeamMemberAction } from "@/features/places/actions";
import { Link, useRouter } from "@/i18n/navigation";

type Option = { id: string; name: string };
type PlaceJob = { id: string; role: "MANAGER" | "RECEPTIONIST"; listing: { id: string; title: string } };
type RestaurantJob = { id: string; role: "MANAGER" | "STAFF" | "DELIVERY"; restaurant: { id: string; name: string } };

/**
 * Every role this person has at places and restaurants, set here by VIIPA: property manager or receptionist of a
 * place, restaurant manager, kitchen staff or delivery person. Each can be added or taken away.
 */
export function UserRoles({
  email,
  places,
  restaurants,
  placeOptions,
  restaurantOptions,
  ownedRestaurants,
}: {
  email: string;
  places: PlaceJob[];
  restaurants: RestaurantJob[];
  placeOptions: Option[];
  restaurantOptions: Option[];
  ownedRestaurants: Option[];
}) {
  const t = useTranslations("Admin.roles");
  const tPlaces = useTranslations("Places");
  const tFood = useTranslations("Food");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [place, setPlace] = useState({ id: "", role: "MANAGER" as PlaceJob["role"] });
  const [restaurant, setRestaurant] = useState({ id: "", role: "STAFF" as RestaurantJob["role"] });

  const done = (r: { ok: boolean; error?: string }) => {
    if (r.ok) {
      setMessage({ ok: true, text: t("added") });
      router.refresh();
    } else setMessage({ ok: false, text: t(`error.${r.error === "isOwner" ? "isOwner" : r.error === "notAllowed" ? "notAllowed" : "failed"}`) });
  };

  const select = "min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink";
  const addBtn = "inline-flex shrink-0 items-center justify-center gap-1 rounded-full bg-primary px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50";
  const row = "flex items-center gap-3 rounded-xl bg-canvas px-3 py-2";
  const remove = (label: string, run: () => Promise<unknown>) => (
    <button
      type="button"
      disabled={pending}
      aria-label={label}
      onClick={() =>
        start(async () => {
          await run();
          setMessage(null);
          router.refresh();
        })
      }
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-danger hover:bg-danger/5"
    >
      <Trash2 className="size-4" aria-hidden="true" />
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Places: property manager or receptionist. */}
      <section className="flex flex-col gap-2">
        <h3 className="text-[13px] font-semibold text-ink">{t("placesTitle")}</h3>
        {places.length === 0 && <p className="text-[13px] text-muted">{t("none")}</p>}
        {places.map((p) => (
          <div key={p.id} className={row}>
            <span className="min-w-0 flex-1">
              <Link href={`/admin/listings/${p.listing.id}`} className="block truncate text-[14px] font-semibold text-ink hover:text-primary">
                {p.listing.title}
              </Link>
              <span className="text-[12px] text-muted">{tPlaces(`teamRole.${p.role}`)}</span>
            </span>
            {remove(t("remove", { name: p.listing.title }), () => removeTeamMemberAction(p.id))}
          </div>
        ))}
        <div className="flex flex-col gap-2 sm:flex-row">
          <select aria-label={t("choosePlace")} value={place.id} onChange={(e) => setPlace({ ...place, id: e.target.value })} className={select}>
            <option value="">{t("choosePlace")}</option>
            {placeOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select aria-label={t("role")} value={place.role} onChange={(e) => setPlace({ ...place, role: e.target.value as PlaceJob["role"] })} className={select}>
            <option value="MANAGER">{tPlaces("teamRole.MANAGER")}</option>
            <option value="RECEPTIONIST">{tPlaces("teamRole.RECEPTIONIST")}</option>
          </select>
          <button type="button" disabled={pending || !place.id} onClick={() => start(async () => done(await addTeamMemberAction(place.id, email, place.role)))} className={addBtn}>
            <Plus className="size-4" aria-hidden="true" />
            {t("add")}
          </button>
        </div>
      </section>

      {/* Restaurants: manager, kitchen staff or delivery person (owners are set on the restaurant). */}
      <section className="flex flex-col gap-2 border-t border-line pt-4">
        <h3 className="text-[13px] font-semibold text-ink">{t("restaurantsTitle")}</h3>
        {ownedRestaurants.map((r) => (
          <div key={r.id} className={row}>
            <span className="min-w-0 flex-1">
              <Link href={`/admin/restaurants/${r.id}`} className="block truncate text-[14px] font-semibold text-ink hover:text-primary">
                {r.name}
              </Link>
              <span className="text-[12px] text-muted">{tFood("role.OWNER")}</span>
            </span>
          </div>
        ))}
        {restaurants.length === 0 && ownedRestaurants.length === 0 && <p className="text-[13px] text-muted">{t("none")}</p>}
        {restaurants.map((r) => (
          <div key={r.id} className={row}>
            <span className="min-w-0 flex-1">
              <Link href={`/admin/restaurants/${r.restaurant.id}`} className="block truncate text-[14px] font-semibold text-ink hover:text-primary">
                {r.restaurant.name}
              </Link>
              <span className="text-[12px] text-muted">{tFood(`role.${r.role}`)}</span>
            </span>
            {remove(t("remove", { name: r.restaurant.name }), () => removeRestaurantMemberAction(r.id))}
          </div>
        ))}
        <div className="flex flex-col gap-2 sm:flex-row">
          <select aria-label={t("chooseRestaurant")} value={restaurant.id} onChange={(e) => setRestaurant({ ...restaurant, id: e.target.value })} className={select}>
            <option value="">{t("chooseRestaurant")}</option>
            {restaurantOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select aria-label={t("role")} value={restaurant.role} onChange={(e) => setRestaurant({ ...restaurant, role: e.target.value as RestaurantJob["role"] })} className={select}>
            {(["MANAGER", "STAFF", "DELIVERY"] as const).map((r) => (
              <option key={r} value={r}>
                {tFood(`role.${r}`)}
              </option>
            ))}
          </select>
          <button type="button" disabled={pending || !restaurant.id} onClick={() => start(async () => done(await addRestaurantMemberAction(restaurant.id, email, restaurant.role)))} className={addBtn}>
            <Plus className="size-4" aria-hidden="true" />
            {t("add")}
          </button>
        </div>
      </section>

      {message && (
        <p role="status" className={message.ok ? "text-[13px] font-medium text-emerald-700" : "text-[13px] font-medium text-danger"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
