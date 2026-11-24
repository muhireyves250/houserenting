"use client";

import { Select } from "@/components/ui/Select";

import { ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { photoUploadAction } from "@/features/hosting/actions";
import { Button } from "@/components/ui/Button";
import { AreaField, Card, Chip, Field } from "@/features/hosting/components/fields";
import { FACILITIES } from "@/features/hosting/validation";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { removeRoomAction, removeRoomUnitAction, saveRoomAction, saveRoomUnitAction, setRoomStatusAction } from "../actions";
import { roomLabel } from "../links";
import { parseRoomNumbers, ROOM_STATUSES, type RoomInput, type RoomStatus } from "../validation";

type Room = RoomInput & { id: string; status: RoomStatus };

type Unit = RoomInput["rates"][number]["unit"];
const emptyRoom = (units: readonly Unit[]): RoomInput => ({ name: "", description: "", maxGuests: 2, rates: [{ unit: units.includes("NIGHT") ? "NIGHT" : (units[0] ?? "NIGHT"), price: 0, minUnits: 1, maxUnits: null }], discountPercent: null, laundryPricePerKg: null, facilities: [], numbers: [], photos: [], unitDetails: {} });

const STATUS_TONE: Record<RoomStatus, string> = {
  AVAILABLE: "text-emerald-700",
  MAINTENANCE: "text-amber-700",
  UNAVAILABLE: "text-muted",
  CLEANING: "text-primary",
};

/** Rooms of a place that rents by the room: each with its own price, guests, amenities and status. */
export function RoomsEditor({ listingId, rooms, units }: { listingId: string; rooms: Room[]; units: readonly Unit[] }) {
  const t = useTranslations("Rooms");
  const tListings = useTranslations("Listings");
  const locale = useLocale();
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(rooms.length === 0 ? "new" : null);
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  // Room names already used by another type of this place.
  const [taken, setTaken] = useState<string | null>(null);

  const run = (action: () => Promise<{ ok: boolean; errors?: Record<string, string> }>, after?: () => void) =>
    start(async () => {
      const { ok, errors } = await action();
      const clash = errors?.numbers?.startsWith("taken:") ? errors.numbers.slice(6) : null;
      setTaken(clash);
      setFailed(!ok && !clash);
      if (ok) {
        after?.();
        router.refresh();
      }
    });

  return (
    <Card title={t("title")} id="rooms">
      <p className="-mt-2 mb-4 text-[13px] text-muted">{t("intro")}</p>
      <ul className="flex flex-col gap-3">
        {rooms.map((room) =>
          editing === room.id ? (
            <li key={room.id}>
              <RoomForm listingId={listingId} initial={room} isNew={false} units={units} pending={pending} onCancel={() => setEditing(null)} onSave={(input) => run(() => saveRoomAction(listingId, room.id, input), () => setEditing(null))} />
            </li>
          ) : (
            <li key={room.id} className="flex flex-col gap-3 rounded-2xl border border-line p-4">
              {/* The category: its name, prices, status, and Edit category. */}
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-bold text-ink">{room.name}</p>
                  <p className="text-[13px] text-muted">
                    {/* No price of its own: from its cheapest room (or "add its rooms' prices"). */}
                    {room.rates.some((r) => (r.price ?? 0) > 0)
                      ? room.rates.filter((r) => (r.price ?? 0) > 0).map((r) => `${t("from")} ${formatRWF(r.price ?? 0, locale)} ${tListings(`perUnit.${r.unit}`)}`).join(" · ")
                      : t("noRoomPrices")}{" "}
                    · {t("guests", { count: room.maxGuests })}
                  </p>
                </div>
                <Select
                  value={room.status}
                  disabled={pending}
                  aria-label={t("status")}
                  onChange={(e) => run(() => setRoomStatusAction(room.id, e.target.value as RoomStatus))}
                  className={cn("cursor-pointer rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-[13px] font-semibold", STATUS_TONE[room.status])}
                >
                  {ROOM_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`statuses.${s}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setEditing(room.id)} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover">
                  <Pencil className="size-3.5" aria-hidden="true" />
                  {t("editCategory")}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => removeRoomAction(room.id))}
                  aria-label={t("remove", { name: room.name })}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-[13px] font-semibold text-danger hover:border-danger"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  {t("removeCategory")}
                </button>
              </div>
              {/* Its rooms: tap one to edit it (name, photos, description), or add one. */}
              <CategoryRooms listingId={listingId} room={room} />
            </li>
          ),
        )}
      </ul>
      {taken && (
        <p role="alert" className="mt-3 text-[13px] font-medium text-danger">
          {t("numbersTaken", { names: taken })}
        </p>
      )}
      {failed && (
        <p role="alert" className="mt-3 text-[13px] font-medium text-danger">
          {t("failed")}
        </p>
      )}
      <div className="mt-4">
        {editing === "new" ? (
          <RoomForm listingId={listingId} initial={emptyRoom(units)} isNew units={units} pending={pending} onCancel={rooms.length > 0 ? () => setEditing(null) : undefined} onSave={(input) => run(() => saveRoomAction(listingId, null, input), () => setEditing(null))} />
        ) : (
          <Button variant="outline" onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden="true" />
            {t("add")}
          </Button>
        )}
      </div>
    </Card>
  );
}

function RoomForm({
  listingId,
  initial,
  isNew,
  units,
  pending,
  onSave,
  onCancel,
}: {
  listingId: string;
  initial: RoomInput;
  /** A new category also takes its rooms' numbers; an existing one's rooms are edited one by one below it. */
  isNew: boolean;
  units: readonly Unit[];
  pending: boolean;
  onSave: (input: RoomInput) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("Rooms");
  const tListings = useTranslations("Listings");
  const tFacility = useTranslations("Facility");
  const [room, setRoom] = useState<RoomInput>(initial);
  const [numbersText, setNumbersText] = useState((initial.numbers ?? []).join(", "));
  const set = <K extends keyof RoomInput>(key: K, value: RoomInput[K]) => setRoom((r) => ({ ...r, [key]: value }));
  const rates = room.rates ?? [];
  // The category has no price: rooms do. A new way of booking (or a new category) gets one starting price, given to
  // each of its rooms; each room's own price is then changed on the room.
  const existingUnits = new Set(isNew ? [] : initial.rates.map((r) => r.unit));
  const startPrice = (unit: Unit) => !existingUnits.has(unit);
  const valid = room.name.trim().length >= 2 && rates.length > 0 && room.maxGuests >= 1 && rates.every((r) => !startPrice(r.unit as Unit) || (r.price ?? 0) >= 100);
  const priceOf = (unit: Unit) => rates.find((r) => r.unit === unit);
  const toggleUnit = (unit: Unit) =>
    set("rates", priceOf(unit) ? rates.filter((r) => r.unit !== unit) : [...rates, { unit, price: 0 }]);
  const setRate = (unit: Unit, patch: Partial<RoomInput["rates"][number]>) => set("rates", rates.map((r) => (r.unit === unit ? { ...r, ...patch } : r)));
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-primary/[0.02] p-4">
      <p className="text-[15px] font-bold text-ink">{isNew ? t("add") : t("editCategory")}</p>
      <Field label={t("typeName")} value={room.name} maxLength={60} onChange={(e) => set("name", e.target.value)} />
      {/* A new category: list its rooms now (each is then edited on its own). */}
      {isNew && (
        <Field
          label={t("numbers")}
          value={numbersText}
          placeholder={t("numbersHint")}
          onChange={(e) => {
            setNumbersText(e.target.value);
            set("numbers", parseRoomNumbers(e.target.value));
          }}
        />
      )}
      <Field label={t("maxGuests")} type="number" min={1} value={room.maxGuests || ""} onChange={(e) => set("maxGuests", Number(e.target.value) || 0)} />
      {/* How this category is booked (its rooms each have their own price). */}
      <p className="text-xs font-semibold text-muted">{t("howBooked")}</p>
      <div className="flex flex-wrap gap-2">
        {units.map((unit) => (
          <Chip key={unit} on={Boolean(priceOf(unit))} onToggle={() => toggleUnit(unit)}>
            {tListings(`unitName.${unit}`)}
          </Chip>
        ))}
      </div>
      {/* Each way of booking this category: its own rules (shortest and longest stay, times); a new one's starting room price. */}
      <div className="flex flex-col gap-3">
        {units
          .filter((unit) => priceOf(unit))
          .map((unit) => {
            const r = priceOf(unit)!;
            const byTime = unit === "HOUR" || unit === "DAY";
            return (
              <div key={unit} className="grid grid-cols-2 gap-3 rounded-xl bg-canvas p-3 sm:grid-cols-3">
                <p className="col-span-full text-[13px] font-semibold text-ink">{tListings(`unitName.${unit}`)}</p>
                {startPrice(unit) && <Field label={`${t("startPrice")} ${tListings(`perUnit.${unit}`)}`} type="number" min={0} value={r.price || ""} onChange={(e) => setRate(unit, { price: Number(e.target.value) || 0 })} />}
                <Field label={t("rules.min")} type="number" min={1} value={r.minUnits ?? 1} onChange={(e) => setRate(unit, { minUnits: Math.max(1, Number(e.target.value) || 1) })} />
                <Field label={t("rules.max")} type="number" min={1} placeholder={t("rules.noMax")} value={r.maxUnits ?? ""} onChange={(e) => setRate(unit, { maxUnits: e.target.value ? Number(e.target.value) : null })} />
                <Field label={byTime ? t("rules.openFrom") : t("rules.checkIn")} type="time" value={(byTime ? r.dayStartTime : r.checkInTime) ?? ""} onChange={(e) => setRate(unit, byTime ? { dayStartTime: e.target.value || null } : { checkInTime: e.target.value || null })} />
                <Field label={byTime ? t("rules.openUntil") : t("rules.checkOut")} type="time" value={(byTime ? r.dayEndTime : r.checkOutTime) ?? ""} onChange={(e) => setRate(unit, byTime ? { dayEndTime: e.target.value || null } : { checkOutTime: e.target.value || null })} />
              </div>
            );
          })}
      </div>
      {/* This category's own discount and laundry price (empty: the place's). */}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("rules.discount")} type="number" min={0} max={90} placeholder={t("rules.placeDefault")} value={room.discountPercent ?? ""} onChange={(e) => set("discountPercent", e.target.value === "" ? null : Number(e.target.value))} />
        <Field label={t("rules.laundry")} type="number" min={0} placeholder={t("rules.placeDefault")} value={room.laundryPricePerKg ?? ""} onChange={(e) => set("laundryPricePerKg", e.target.value === "" ? null : Number(e.target.value))} />
      </div>
      <RoomPhotos listingId={listingId} photos={room.photos ?? []} onChange={(photos) => set("photos", photos)} />
      <AreaField label={t("description")} rows={2} maxLength={500} value={room.description ?? ""} onChange={(e) => set("description", e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {FACILITIES.map((f) => {
          const on = (room.facilities ?? []).includes(f);
          return (
            <Chip key={f} on={on} onToggle={() => set("facilities", on ? room.facilities.filter((x) => x !== f) : [...room.facilities, f])}>
              {tFacility(f)}
            </Chip>
          );
        })}
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            {t("cancel")}
          </Button>
        )}
        <Button loading={pending} disabled={!valid} onClick={() => onSave(room)}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}

/**
 * A category's rooms as buttons ("Room 11", "Lake Kivu"…). Tapping one opens its own form: name or number, photos
 * and description (empty = the category's), save or remove. "Add a room" opens an empty one.
 */
function CategoryRooms({ listingId, room }: { listingId: string; room: Room }) {
  const t = useTranslations("Rooms");
  const locale = useLocale();
  const [open, setOpen] = useState<string | "new" | null>(null);
  const numbers = room.numbers ?? [];
  const details = room.unitDetails ?? {};
  const label = (n: string) => roomLabel(n, (number) => t("roomNumber", { number }));
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <p className="text-[12px] font-semibold text-muted">{t("roomsInCategory", { count: numbers.length })}</p>
      <div className="flex flex-wrap gap-2">
        {numbers.map((n) => {
          const own = (details[n]?.photos?.length ?? 0) > 0 || Boolean(details[n]?.description);
          // The room's own price (the first way of booking), or "no price" to fix.
          const first = room.rates[0];
          const price = first ? details[n]?.prices?.[first.unit] : undefined;
          return (
            <button
              key={n}
              type="button"
              aria-expanded={open === n}
              onClick={() => setOpen(open === n ? null : n)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                open === n ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink hover:border-primary",
              )}
            >
              {label(n)}
              <span className={cn("font-normal", open === n ? "text-white/80" : price ? "text-muted" : "text-amber-700")}>{price ? `· ${formatRWF(price, locale)}` : `· ${t("noPrice")}`}</span>
              {own && <span className={cn("size-1.5 rounded-full", open === n ? "bg-white" : "bg-primary")} aria-hidden="true" />}
              <Pencil className="size-3" aria-hidden="true" />
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(open === "new" ? null : "new")}
          className={cn("inline-flex items-center gap-1 rounded-full border border-dashed px-3.5 py-1.5 text-[13px] font-semibold", open === "new" ? "border-primary text-primary" : "border-primary/50 text-primary hover:border-primary")}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {t("addRoom")}
        </button>
      </div>
      {open && (
        <RoomUnitForm
          key={open}
          listingId={listingId}
          roomId={room.id}
          previous={open === "new" ? null : open}
          units={room.rates.map((r) => r.unit)}
          initial={open === "new" ? { name: "", photos: [], description: "", prices: {} } : { name: open, photos: details[open]?.photos ?? [], description: details[open]?.description ?? "", prices: details[open]?.prices ?? {} }}
          onDone={() => setOpen(null)}
        />
      )}
    </div>
  );
}

/** One room: its name or number, its own photos and description; save, remove, or close. */
function RoomUnitForm({
  listingId,
  roomId,
  previous,
  units,
  initial,
  onDone,
}: {
  listingId: string;
  roomId: string;
  previous: string | null;
  /** The ways its category is booked: the room has a price for each. */
  units: Unit[];
  initial: { name: string; photos: string[]; description: string; prices: Partial<Record<Unit, number>> };
  onDone: () => void;
}) {
  const tListings = useTranslations("Listings");
  const t = useTranslations("Rooms");
  const router = useRouter();
  const [unit, setUnit] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const finish = (action: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const result = await action();
      if (result.ok) {
        onDone();
        router.refresh();
      } else setError(t(`unitError.${(result.error ?? "notAllowed") as "taken"}`));
    });
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-canvas p-3">
      <Field label={t("unitName")} value={unit.name} maxLength={40} placeholder={t("unitNameHint")} onChange={(e) => setUnit({ ...unit, name: e.target.value })} />
      {/* This room's own price for each way its category is booked. */}
      <div className="grid grid-cols-2 gap-3">
        {units.map((u) => (
          <Field
            key={u}
            label={`${t("price")} ${tListings(`perUnit.${u}`)}`}
            type="number"
            min={0}
            value={unit.prices[u] || ""}
            onChange={(e) => setUnit({ ...unit, prices: { ...unit.prices, [u]: Number(e.target.value) || 0 } })}
          />
        ))}
      </div>
      <RoomPhotos listingId={listingId} label={t("unitPhotos")} photos={unit.photos} onChange={(photos) => setUnit({ ...unit, photos })} />
      <AreaField label={t("unitAbout")} rows={2} maxLength={500} value={unit.description} onChange={(e) => setUnit({ ...unit, description: e.target.value })} />
      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {previous !== null ? (
          confirming ? (
            <span className="inline-flex flex-wrap items-center gap-2 text-[13px] text-red-900">
              {t("removeUnitQuestion")}
              <button type="button" disabled={pending} onClick={() => finish(() => removeRoomUnitAction(roomId, previous))} className="rounded-full bg-danger px-3 py-1 font-semibold text-white disabled:opacity-50">
                {t("removeUnit")}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="rounded-full px-2 py-1 font-semibold text-ink">
                {t("cancel")}
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-danger hover:underline">
              <Trash2 className="size-3.5" aria-hidden="true" />
              {t("removeUnit")}
            </button>
          )
        ) : (
          <span />
        )}
        <span className="flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            {t("cancel")}
          </Button>
          <Button loading={pending} disabled={!unit.name.trim() || units.some((u) => (unit.prices[u] ?? 0) < 100)} onClick={() => finish(() => saveRoomUnitAction(roomId, previous, unit))}>
            {t("saveUnit")}
          </Button>
        </span>
      </div>
    </div>
  );
}

/** The room type's photos: upload straight to our Cloudinary folder, remove, saved with the room. */
function RoomPhotos({ listingId, photos, onChange, label }: { listingId: string; photos: string[]; onChange: (photos: string[]) => void; label?: string }) {
  const t = useTranslations("Rooms");
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [failed, setFailed] = useState(false);
  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setFailed(false);
    const images = [...files].filter((f) => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024).slice(0, 12 - photos.length);
    setBusy(images.length);
    const added: string[] = [];
    for (const file of images) {
      const ticket = await photoUploadAction(listingId).catch(() => null);
      if (!ticket) {
        setFailed(true);
        setBusy((n) => n - 1);
        continue;
      }
      const body = new FormData();
      body.append("file", file);
      body.append("api_key", ticket.apiKey);
      body.append("timestamp", String(ticket.timestamp));
      body.append("folder", ticket.folder);
      body.append("signature", ticket.signature);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${ticket.cloudName}/image/upload`, { method: "POST", body }).catch(() => null);
      if (res?.ok) added.push(((await res.json()) as { secure_url: string }).secure_url);
      else setFailed(true);
      setBusy((n) => n - 1);
    }
    if (added.length) onChange([...photos, ...added]);
    if (input.current) input.current.value = "";
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-muted">{label ?? t("photos")}</p>
      <div className="flex flex-wrap gap-2">
        {photos.map((url) => (
          <span key={url} className="relative size-20 overflow-hidden rounded-xl bg-canvas ring-1 ring-line">
            {/* eslint-disable-next-line @next/next/no-img-element -- uploaded room photo */}
            <img src={url} alt="" className="size-full object-cover" />
            <button
              type="button"
              aria-label={t("removePhoto")}
              onClick={() => onChange(photos.filter((p) => p !== url))}
              className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-white/90 text-ink shadow"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        ))}
        {photos.length < 12 && (
          <button
            type="button"
            disabled={busy > 0}
            onClick={() => input.current?.click()}
            className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] border-dashed border-primary/40 text-[11px] font-semibold text-primary hover:border-primary disabled:opacity-60"
          >
            <ImagePlus className="size-5" aria-hidden="true" />
            {busy > 0 ? t("uploading") : t("addPhotos")}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
      {failed && <p className="text-[12px] text-danger">{t("photoFailed")}</p>}
    </div>
  );
}
