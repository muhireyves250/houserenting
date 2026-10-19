"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { AreaField, Card, Field, SelectField } from "@/features/hosting/components/fields";
import { useRouter } from "@/i18n/navigation";
import { saveRestaurantAction } from "../actions";
import type { RestaurantInput } from "../validation";

const MapPicker = dynamic(() => import("@/features/hosting/components/MapPicker").then((m) => m.MapPicker), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-[#eceef1]" />,
});

export const EMPTY_RESTAURANT: RestaurantInput = {
  name: "",
  description: "",
  phone: null,
  addressLine: "",
  district: "",
  city: "Kigali",
  lat: -1.9441,
  lng: 30.0619,
  openingHours: "",
  photoUrl: null,
  pickup: true,
  delivery: false,
  deliveryFee: 0,
  deliveryKm: 5,
  listingId: null,
};

/** Create or edit a restaurant: where it is, how it serves (pickup, delivery), and which of your places it belongs to. */
export function RestaurantForm({
  restaurantId,
  initial,
  places,
  staffNew = false,
  after,
}: {
  restaurantId: string | null;
  initial: RestaurantInput;
  places: { id: string; title: string }[];
  /** Staff creating one for an owner: ask for the owner's email. */
  staffNew?: boolean;
  /** Where to go after creating (the id is appended). */
  after: string;
}) {
  const t = useTranslations("Food");
  const router = useRouter();
  const [form, setForm] = useState<RestaurantInput>(initial);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof RestaurantInput>(k: K, v: RestaurantInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };
  const err = (k: string) => (errors[k] ? (errors[k] === "noAccount" ? t("ownerMissing") : errors[k] === "needsOne" ? t("needsOne") : t("checkField")) : undefined);

  const save = () =>
    start(async () => {
      const result = await saveRestaurantAction(restaurantId, form, staffNew ? ownerEmail || null : null);
      if (result.ok) {
        setErrors({});
        setSaved(true);
        if (restaurantId === null) router.replace(`${after}/${result.id}`);
        else router.refresh();
      } else if ("errors" in result) setErrors(result.errors);
      else setErrors({ form: result.error });
    });

  return (
    <div className="flex flex-col gap-4">
      <Card title={t("aboutTitle")}>
        <div className="grid gap-3">
          {staffNew && <Field label={t("ownerEmailOptional")} type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} error={err("ownerEmail")} />}
          <Field label={t("name")} value={form.name} maxLength={80} onChange={(e) => set("name", e.target.value)} error={err("name")} />
          <AreaField label={t("description")} rows={3} value={form.description ?? ""} maxLength={1000} onChange={(e) => set("description", e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("phone")} inputMode="tel" value={form.phone ?? ""} maxLength={20} onChange={(e) => set("phone", e.target.value || null)} />
            <Field label={t("hours")} placeholder={t("hoursHint")} value={form.openingHours ?? ""} maxLength={120} onChange={(e) => set("openingHours", e.target.value)} />
          </div>
          <Field label={t("photoUrl")} type="url" value={form.photoUrl ?? ""} onChange={(e) => set("photoUrl", e.target.value || null)} error={err("photoUrl")} />
          {places.length > 0 && (
            <SelectField label={t("atPlace")} value={form.listingId ?? ""} onChange={(e) => set("listingId", e.target.value || null)}>
              <option value="">{t("standalone")}</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </SelectField>
          )}
        </div>
      </Card>
      <Card title={t("whereTitle")}>
        <div className="grid gap-3">
          <Field label={t("address")} value={form.addressLine} maxLength={120} onChange={(e) => set("addressLine", e.target.value)} error={err("addressLine")} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("district")} value={form.district} maxLength={60} onChange={(e) => set("district", e.target.value)} error={err("district")} />
            <Field label={t("city")} value={form.city} maxLength={60} onChange={(e) => set("city", e.target.value)} error={err("city")} />
          </div>
          <div className="h-64 overflow-hidden rounded-2xl border border-line/70">
            <MapPicker lat={form.lat} lng={form.lng} label={t("pin")} onChange={(lat, lng) => setForm((f) => ({ ...f, lat, lng }))} />
          </div>
        </div>
      </Card>
      <Card title={t("serviceTitle")}>
        <div className="flex flex-col gap-3">
          <label className="flex cursor-pointer items-center gap-3 text-[15px] text-ink">
            <input type="checkbox" checked={form.pickup} onChange={(e) => set("pickup", e.target.checked)} className="size-5 accent-[var(--color-primary)]" />
            {t("pickup")}
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-[15px] text-ink">
            <input type="checkbox" checked={form.delivery} onChange={(e) => set("delivery", e.target.checked)} className="size-5 accent-[var(--color-primary)]" />
            {t("delivery")}
          </label>
          {err("pickup") && <p className="text-[13px] font-medium text-danger">{err("pickup")}</p>}
          {form.delivery && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("deliveryFee")} type="number" min={0} value={form.deliveryFee} onChange={(e) => set("deliveryFee", Number(e.target.value) || 0)} error={err("deliveryFee")} />
              <Field label={t("deliveryKm")} type="number" min={1} max={50} value={form.deliveryKm} onChange={(e) => set("deliveryKm", Number(e.target.value) || 1)} error={err("deliveryKm")} />
            </div>
          )}
        </div>
      </Card>
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-[13px] text-emerald-700">{t("saved")}</span>}
        {Object.keys(errors).length > 0 && <span className="text-[13px] font-medium text-danger">{t("checkForm")}</span>}
        <Button size="lg" loading={pending} onClick={save}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
