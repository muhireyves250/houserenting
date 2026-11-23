"use client";

import { EMPTY_LOCATION, LocationPicker } from "@/features/locations/LocationPicker";
import { locationCodesAction } from "@/features/locations/actions";
import { PersonPicker } from "@/features/admin/components/PersonPicker";
import dynamic from "next/dynamic";
import { ImagePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { AreaField, Card, Field } from "@/features/hosting/components/fields";
import { useRouter } from "@/i18n/navigation";
import { restaurantPhotoTicketAction } from "@/features/users/photo-actions";
import { uploadImage } from "@/lib/cloudinary-upload";
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
  villageCode: "",
  lat: -1.9441,
  lng: 30.0619,
  openingHours: "",
  photoUrl: null,
  pickup: false,
  delivery: false,
  deliveryFee: 0,
  deliveryKm: 5,
  prepMinutes: 30,
  minOrder: 0,
  listingId: null,
};

/** Create or edit a restaurant: where it is and how it delivers (VIIPA sets the places it cooks for, on each place). */
export function RestaurantForm({
  restaurantId,
  initial,
  staffNew = false,
  after,
}: {
  restaurantId: string | null;
  initial: RestaurantInput;
  /** Staff creating one for an owner: ask for the owner's email. */
  staffNew?: boolean;
  /** Where to go after creating (the id is appended). */
  after: string;
}) {
  const t = useTranslations("Food");
  const tLoc = useTranslations("Locations");
  // A saved restaurant opens the location picker on its village (codes looked up once).
  const [locationCodes, setLocationCodes] = useState<Record<string, string> | null | undefined>(initial.villageCode ? undefined : null);
  useEffect(() => {
    if (!initial.villageCode) return;
    locationCodesAction(initial.villageCode).then((c) => setLocationCodes(c ?? null));
  }, [initial.villageCode]);
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
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  /** The photo goes to Cloudinary; only its link is saved with the restaurant. */
  async function uploadPhoto(file: File | undefined, input: HTMLInputElement) {
    input.value = "";
    if (!file) return;
    setPhotoError(null);
    const ticket = await restaurantPhotoTicketAction(restaurantId).catch(() => null);
    if (!ticket) return setPhotoError(t("photoUnavailable"));
    setPhotoBusy(true);
    const uploaded = await uploadImage(ticket, file);
    setPhotoBusy(false);
    if (uploaded) set("photoUrl", uploaded.url);
    else setPhotoError(t("photoFailed"));
  }
  const err = (k: string) => (errors[k] ? (errors[k] === "noAccount" ? t("ownerMissing") : errors[k] === "needsOne" ? t("needsOne") : errors[k] === "notRestaurateur" ? t("notRestaurateur") : t("checkField")) : undefined);

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
          {staffNew && (
            <div>
              {/* Only people VIIPA gave the restaurant owner/manager role (set on their account first). */}
              <PersonPicker label={t("ownerEmailOptional")} onChange={setOwnerEmail} only="restaurant" canCreate={false} />
              <p className="mt-1 text-[12px] text-muted">{t("ownerRoleHint")}</p>
              {err("ownerEmail") && <p className="mt-1 text-[13px] font-medium text-danger">{err("ownerEmail")}</p>}
            </div>
          )}
          <Field label={t("name")} value={form.name} maxLength={80} onChange={(e) => set("name", e.target.value)} error={err("name")} />
          <AreaField label={t("description")} rows={3} value={form.description ?? ""} maxLength={1000} onChange={(e) => set("description", e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("phone")} inputMode="tel" value={form.phone ?? ""} maxLength={20} onChange={(e) => set("phone", e.target.value || null)} />
            <Field label={t("hours")} placeholder={t("hoursHint")} value={form.openingHours ?? ""} maxLength={120} onChange={(e) => set("openingHours", e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <span className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-soft text-primary">
              {form.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- preview of the just-uploaded photo
                <img src={form.photoUrl} alt="" className="absolute inset-0 size-full object-cover" />
              ) : (
                <ImagePlus className="size-7" aria-hidden="true" />
              )}
            </span>
            <span className="flex flex-col items-start gap-1">
              <label className="cursor-pointer rounded-full border border-line bg-surface px-4 py-2 text-[13px] font-semibold text-ink hover:border-primary">
                {photoBusy ? t("photoUploading") : form.photoUrl ? t("changePhoto") : t("addPhoto")}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={photoBusy} onChange={(e) => void uploadPhoto(e.target.files?.[0], e.target)} />
              </label>
              {form.photoUrl && (
                <button type="button" onClick={() => set("photoUrl", null)} className="text-xs font-semibold text-muted hover:text-danger">
                  {t("removePhoto")}
                </button>
              )}
              {photoError && <span className="text-xs font-medium text-danger">{photoError}</span>}
            </span>
          </div>
        </div>
      </Card>
      <Card title={t("whereTitle")}>
        <div className="grid gap-3">
          <Field label={t("address")} value={form.addressLine} maxLength={120} onChange={(e) => set("addressLine", e.target.value)} error={err("addressLine")} />
          {/* Official Rwanda locations only: province down to village. */}
          {locationCodes !== undefined && (
            <LocationPicker
              key={initial?.villageCode || "new"}
              value={{ ...EMPTY_LOCATION, district: form.district, villageCode: form.villageCode ?? "" }}
              startCodes={locationCodes}
              error={err("villageCode") ? tLoc("required") : undefined}
              onChange={(v) => setForm((f) => ({ ...f, district: v.district || f.district, villageCode: v.villageCode }))}
            />
          )}
          <Field label={t("city")} value={form.city} maxLength={60} onChange={(e) => set("city", e.target.value)} error={err("city")} />
          <div className="h-64 overflow-hidden rounded-2xl border border-line/70">
            <MapPicker lat={form.lat} lng={form.lng} label={t("pin")} onChange={(lat, lng) => setForm((f) => ({ ...f, lat, lng }))} />
          </div>
        </div>
      </Card>
      <Card title={t("serviceTitle")}>
        <div className="flex flex-col gap-3">
          <label className="flex cursor-pointer items-center gap-3 text-[15px] text-ink">
            <input type="checkbox" checked={form.delivery} onChange={(e) => set("delivery", e.target.checked)} className="size-5 accent-[var(--color-primary)]" />
            {t("delivery")}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("prepMinutes")} type="number" min={5} max={240} value={form.prepMinutes ?? 30} onChange={(e) => set("prepMinutes", Number(e.target.value) || 30)} error={err("prepMinutes")} />
            <Field label={t("minOrder")} type="number" min={0} value={form.minOrder ?? 0} onChange={(e) => set("minOrder", Number(e.target.value) || 0)} error={err("minOrder")} />
          </div>
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
