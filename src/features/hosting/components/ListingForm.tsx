"use client";

import { Check, LoaderCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { PLACE_TYPES } from "@/features/search/params";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { saveListingAction } from "../actions";
import { FACILITIES, RATE_UNITS, rateUnitsFor, type ListingInput } from "../validation";
import { AreaField, Card, Chip, Field, SelectField } from "./fields";

const MapPicker = dynamic(() => import("./MapPicker").then((m) => m.MapPicker), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-[#eceef1]" />,
});

type Unit = (typeof RATE_UNITS)[number];
type Rate = ListingInput["rates"][number];

// Kigali city centre: where the pin starts for a new place.
const KIGALI = { lat: -1.9441, lng: 30.0619 };

export const EMPTY_LISTING: ListingInput = {
  title: "",
  description: "",
  type: "APARTMENT",
  bookingModel: "WHOLE_PROPERTY",
  addressLine: "",
  district: "",
  city: "Kigali",
  lat: KIGALI.lat,
  lng: KIGALI.lng,
  sizeM2: 0,
  rooms: 1,
  bedrooms: 1,
  bathrooms: 1,
  maxGuests: 2,
  petsAllowed: false,
  facilities: [],
  characteristics: [],
  termsOfRent: [],
  depositMonths: null,
  discountPercent: null,
  rates: [],
};

const NEW_RATE: Record<Unit, Rate> = {
  HOUR: { unit: "HOUR", price: 0, minUnits: 1, maxUnits: null, dayStartTime: "08:00", dayEndTime: "20:00" },
  DAY: { unit: "DAY", price: 0, minUnits: 1, maxUnits: null, dayStartTime: "08:00", dayEndTime: "20:00" },
  NIGHT: { unit: "NIGHT", price: 0, minUnits: 1, maxUnits: null, checkInTime: "14:00", checkOutTime: "11:00" },
  WEEK: { unit: "WEEK", price: 0, minUnits: 1, maxUnits: null },
  MONTH: { unit: "MONTH", price: 0, minUnits: 1, maxUnits: null },
  YEAR: { unit: "YEAR", price: 0, minUnits: 1, maxUnits: null },
};

const num = (value: string) => (value === "" ? 0 : Number(value));
const optionalNum = (value: string) => (value === "" ? null : Number(value));
const lines = (value: string) => value.split("\n");

/** Create or edit a place: everything guests see except photos (added once the place is saved). */
export function ListingForm({ listingId, initial, live }: { listingId: string | null; initial: ListingInput; live: boolean }) {
  const t = useTranslations("Host");
  const tType = useTranslations("ListingType");
  const tFacility = useTranslations("Facility");
  const tListings = useTranslations("Listings");
  const router = useRouter();
  const [form, setForm] = useState<ListingInput>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saved" | "failed" | "invalid">("idle");
  const [saving, startSaving] = useTransition();

  const set = <K extends keyof ListingInput>(key: K, value: ListingInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setStatus("idle");
  };
  const err = (key: string) => {
    const code = errors[key];
    if (!code) return undefined;
    return code === "maxBelowMin"
      ? t("errors.maxBelowMin")
      : code === "duplicateUnit"
        ? t("errors.duplicateUnit")
        : code === "lodgeUnits"
          ? t("errors.lodgeUnits")
          : t("errors.field");
  };
  const rateIndex = (unit: Unit) => form.rates.findIndex((r) => r.unit === unit);
  const setRate = (unit: Unit, patch: Partial<Rate>) =>
    set(
      "rates",
      form.rates.map((r) => (r.unit === unit ? { ...r, ...patch } : r)),
    );
  const toggleRate = (unit: Unit) =>
    set("rates", rateIndex(unit) >= 0 ? form.rates.filter((r) => r.unit !== unit) : [...form.rates, NEW_RATE[unit]]);

  function save() {
    startSaving(async () => {
      const result = await saveListingAction(listingId, form);
      if (result.ok) {
        setErrors({});
        setStatus("saved");
        if (listingId === null) router.replace(`/host/listings/${result.id}`);
        else router.refresh();
        return;
      }
      if ("errors" in result) {
        setErrors(result.errors);
        setStatus("invalid");
        // Show the first problem.
        requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" }));
        return;
      }
      setStatus("failed");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {live && <p className="rounded-2xl bg-amber-50 px-5 py-3.5 text-sm text-amber-900 ring-1 ring-amber-200/70">{t("reviewNote")}</p>}

      <Card title={t("sections.basics")}>
        <div className="grid gap-3">
          <Field label={t("fields.title")} value={form.title} maxLength={100} onChange={(e) => set("title", e.target.value)} error={err("title")} />
          <SelectField
            label={t("fields.type")}
            value={form.type}
            onChange={(e) => {
              const type = e.target.value as ListingInput["type"];
              // A lodge keeps only nightly and daily prices.
              setForm((f) => ({ ...f, type, rates: f.rates.filter((r) => rateUnitsFor(type).includes(r.unit)) }));
              setStatus("idle");
            }}
          >
            {PLACE_TYPES.map((type) => (
              <option key={type} value={type}>
                {tType(type)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={t("fields.bookingModel")}
            value={form.bookingModel}
            onChange={(e) => set("bookingModel", e.target.value as NonNullable<ListingInput["bookingModel"]>)}
          >
            {(["WHOLE_PROPERTY", "ROOM_BY_ROOM", "BOTH"] as const).map((model) => (
              <option key={model} value={model}>
                {t(`bookingModel.${model}`)}
              </option>
            ))}
          </SelectField>
          <AreaField
            label={t("fields.description")}
            value={form.description}
            maxLength={5000}
            rows={5}
            onChange={(e) => set("description", e.target.value)}
            error={err("description")}
          />
        </div>
      </Card>

      <Card title={t("sections.location")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("fields.address")} className="sm:col-span-2" value={form.addressLine} onChange={(e) => set("addressLine", e.target.value)} error={err("addressLine")} />
          <Field label={t("fields.district")} value={form.district} onChange={(e) => set("district", e.target.value)} error={err("district")} />
          <Field label={t("fields.city")} value={form.city} onChange={(e) => set("city", e.target.value)} error={err("city")} />
        </div>
        <p className={cn("mt-4 mb-2 text-[13px]", err("lat") || err("lng") ? "font-medium text-danger" : "text-muted")}>
          {err("lat") || err("lng") ? t("errors.pin") : t("fields.pin")}
        </p>
        <div className="h-72 overflow-hidden rounded-2xl border border-line/70">
          <MapPicker
            lat={form.lat}
            lng={form.lng}
            label={t("fields.pin")}
            onChange={(lat, lng) => setForm((f) => ({ ...f, lat, lng }))}
          />
        </div>
      </Card>

      <Card title={t("sections.space")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(
            [
              ["sizeM2", "size"],
              ["rooms", "rooms"],
              ["bedrooms", "bedrooms"],
              ["bathrooms", "bathrooms"],
              ["maxGuests", "maxGuests"],
            ] as const
          ).map(([key, label]) => (
            <Field
              key={key}
              label={t(`fields.${label}`)}
              type="number"
              inputMode="numeric"
              min={0}
              value={form[key] || ""}
              onChange={(e) => set(key, num(e.target.value))}
              error={err(key)}
            />
          ))}
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-3 text-[15px] text-ink">
          <input
            type="checkbox"
            checked={form.petsAllowed}
            onChange={(e) => set("petsAllowed", e.target.checked)}
            className="size-5 cursor-pointer accent-[var(--color-primary)]"
          />
          {t("fields.pets")}
        </label>
      </Card>

      <Card title={t("sections.amenities")}>
        <div className="flex flex-wrap gap-2">
          {FACILITIES.map((facility) => {
            const on = (form.facilities ?? []).includes(facility);
            return (
              <Chip
                key={facility}
                on={on}
                onToggle={() => set("facilities", on ? form.facilities.filter((f) => f !== facility) : [...form.facilities, facility])}
              >
                {tFacility(facility)}
              </Chip>
            );
          })}
        </div>
      </Card>

      <Card title={t("sections.prices")}>
        <p className="-mt-2 mb-4 text-[13px] text-muted">
          {t("pricesHint")} {form.bookingModel !== "WHOLE_PROPERTY" && t("pricesRoomsHint")}
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {rateUnitsFor(form.type).map((unit) => (
            <Chip key={unit} on={rateIndex(unit) >= 0} onToggle={() => toggleRate(unit)}>
              {tListings(`unitName.${unit}`)}
            </Chip>
          ))}
        </div>
        {(err("rates") || (status === "invalid" && form.rates.length === 0)) && (
          <p role="alert" className="mb-3 text-[13px] font-medium text-danger">
            {form.rates.length === 0 ? t("errors.noRates") : err("rates")}
          </p>
        )}
        <div className="flex flex-col gap-4">
          {RATE_UNITS.filter((unit) => rateIndex(unit) >= 0).map((unit) => {
            const i = rateIndex(unit);
            const rate = form.rates[i];
            const e = (field: string) => err(`rates.${i}.${field}`);
            return (
              <fieldset key={unit} className="rounded-2xl border border-line p-4">
                <legend className="px-1 text-[15px] font-semibold text-ink">{tListings(`unitName.${unit}`)}</legend>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field
                    label={t("fields.price")}
                    className="col-span-2"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={rate.price || ""}
                    onChange={(ev) => setRate(unit, { price: num(ev.target.value) })}
                    error={e("price")}
                  />
                  <Field
                    label={t(`fields.min.${unit}`)}
                    type="number"
                    min={1}
                    value={rate.minUnits ?? 1}
                    onChange={(ev) => setRate(unit, { minUnits: num(ev.target.value) })}
                    error={e("minUnits")}
                  />
                  <Field
                    label={t(`fields.max.${unit}`)}
                    type="number"
                    min={1}
                    value={rate.maxUnits ?? ""}
                    onChange={(ev) => setRate(unit, { maxUnits: optionalNum(ev.target.value) })}
                    error={e("maxUnits")}
                  />
                  {unit === "NIGHT" && (
                    <>
                      <Field label={t("fields.checkIn")} type="time" value={rate.checkInTime ?? ""} onChange={(ev) => setRate(unit, { checkInTime: ev.target.value || null })} error={e("checkInTime")} />
                      <Field label={t("fields.checkOut")} type="time" value={rate.checkOutTime ?? ""} onChange={(ev) => setRate(unit, { checkOutTime: ev.target.value || null })} error={e("checkOutTime")} />
                    </>
                  )}
                  {(unit === "HOUR" || unit === "DAY") && (
                    <>
                      <Field label={t("fields.dayStart")} type="time" value={rate.dayStartTime ?? ""} onChange={(ev) => setRate(unit, { dayStartTime: ev.target.value || null })} error={e("dayStartTime")} />
                      <Field label={t("fields.dayEnd")} type="time" value={rate.dayEndTime ?? ""} onChange={(ev) => setRate(unit, { dayEndTime: ev.target.value || null })} error={e("dayEndTime")} />
                    </>
                  )}
                </div>
              </fieldset>
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field
            label={t("fields.discount")}
            type="number"
            min={0}
            max={90}
            value={form.discountPercent ?? ""}
            onChange={(e) => set("discountPercent", optionalNum(e.target.value))}
            error={err("discountPercent")}
          />
          <Field
            label={t("fields.deposit")}
            type="number"
            min={0}
            max={12}
            value={form.depositMonths ?? ""}
            onChange={(e) => set("depositMonths", optionalNum(e.target.value))}
            error={err("depositMonths")}
          />
        </div>
      </Card>

      <Card title={t("sections.extras")}>
        <div className="grid gap-3">
          <AreaField
            label={t("fields.characteristics")}
            rows={3}
            value={(form.characteristics ?? []).join("\n")}
            onChange={(e) => set("characteristics", lines(e.target.value))}
            error={err("characteristics")}
          />
          <AreaField
            label={t("fields.terms")}
            rows={4}
            value={(form.termsOfRent ?? []).join("\n")}
            onChange={(e) => set("termsOfRent", lines(e.target.value))}
            error={err("termsOfRent")}
          />
        </div>
      </Card>

      {/* Save bar: stays in reach while scrolling the long form. */}
      <div className="sticky bottom-[calc(82px+env(safe-area-inset-bottom))] z-20 flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-[0_10px_30px_-12px_rgba(16,24,40,0.35)] backdrop-blur md:bottom-4">
        <p role="status" className={cn("text-[13px]", status === "saved" ? "text-emerald-700" : status === "idle" ? "text-muted" : "font-medium text-danger")}>
          {status === "saved" && (
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-4" aria-hidden="true" />
              {t("saved")}
            </span>
          )}
          {status === "invalid" && t("errors.check")}
          {status === "failed" && t("errors.failed")}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-[#0a6fe0] px-7 py-3 text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,87,184,0.8)] transition-[filter,transform] duration-300 hover:brightness-110 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
        >
          {saving && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {t("save")}
        </button>
      </div>
    </div>
  );
}
