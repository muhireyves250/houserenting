"use client";

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
import { removeRoomAction, saveRoomAction, setRoomStatusAction } from "../actions";
import { parseRoomNumbers, ROOM_STATUSES, type RoomInput, type RoomStatus } from "../validation";

type Room = RoomInput & { id: string; status: RoomStatus };

type Unit = RoomInput["rates"][number]["unit"];
const emptyRoom = (units: readonly Unit[]): RoomInput => ({ name: "", description: "", maxGuests: 2, rates: [{ unit: units[0] ?? "NIGHT", price: 0 }], facilities: [], numbers: [], photos: [] });

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

  const run = (action: () => Promise<{ ok: boolean }>, after?: () => void) =>
    start(async () => {
      const { ok } = await action();
      setFailed(!ok);
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
              <RoomForm listingId={listingId} initial={room} units={units} pending={pending} onCancel={() => setEditing(null)} onSave={(input) => run(() => saveRoomAction(listingId, room.id, input), () => setEditing(null))} />
            </li>
          ) : (
            <li key={room.id} className="flex flex-col gap-3 rounded-2xl border border-line p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-ink">{room.name}</p>
                <p className="text-[13px] text-muted">
                  {room.rates.map((r) => `${formatRWF(r.price, locale)} ${tListings(`perUnit.${r.unit}`)}`).join(" · ")} · {t("guests", { count: room.maxGuests })}
                  {(room.numbers?.length ?? 0) > 0 && ` · ${t("roomsCount", { count: room.numbers!.length })}: ${room.numbers!.join(", ")}`}
                </p>
              </div>
              <label className="flex items-center gap-2 text-[13px] text-muted">
                {t("status")}
                <select
                  value={room.status}
                  disabled={pending}
                  onChange={(e) => run(() => setRoomStatusAction(room.id, e.target.value as RoomStatus))}
                  className={cn("cursor-pointer rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-[13px] font-semibold", STATUS_TONE[room.status])}
                >
                  {ROOM_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`statuses.${s}`)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(room.id)} aria-label={t("edit", { name: room.name })} className="flex size-9 items-center justify-center rounded-full bg-canvas text-ink hover:bg-line/70">
                  <Pencil className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => removeRoomAction(room.id))}
                  aria-label={t("remove", { name: room.name })}
                  className="flex size-9 items-center justify-center rounded-full bg-canvas text-danger hover:bg-line/70"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
      {failed && (
        <p role="alert" className="mt-3 text-[13px] font-medium text-danger">
          {t("failed")}
        </p>
      )}
      <div className="mt-4">
        {editing === "new" ? (
          <RoomForm listingId={listingId} initial={emptyRoom(units)} units={units} pending={pending} onCancel={rooms.length > 0 ? () => setEditing(null) : undefined} onSave={(input) => run(() => saveRoomAction(listingId, null, input), () => setEditing(null))} />
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
  units,
  pending,
  onSave,
  onCancel,
}: {
  listingId: string;
  initial: RoomInput;
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
  const valid = room.name.trim().length >= 2 && rates.length > 0 && rates.every((r) => r.price >= 100) && room.maxGuests >= 1;
  const priceOf = (unit: Unit) => rates.find((r) => r.unit === unit);
  const toggleUnit = (unit: Unit) =>
    set("rates", priceOf(unit) ? rates.filter((r) => r.unit !== unit) : [...rates, { unit, price: 0 }]);
  const setPrice = (unit: Unit, price: number) => set("rates", rates.map((r) => (r.unit === unit ? { ...r, price } : r)));
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-primary/[0.02] p-4">
      <Field label={t("typeName")} value={room.name} maxLength={60} onChange={(e) => set("name", e.target.value)} />
      {/* Several identical rooms of this type: list their numbers; each guest is given a free one. */}
      <Field
        label={t("numbers")}
        value={numbersText}
        placeholder={t("numbersHint")}
        onChange={(e) => {
          setNumbersText(e.target.value);
          set("numbers", parseRoomNumbers(e.target.value));
        }}
      />
      <Field label={t("maxGuests")} type="number" min={1} value={room.maxGuests || ""} onChange={(e) => set("maxGuests", Number(e.target.value) || 0)} />
      {/* How this room is booked, each with its own price. */}
      <p className="text-xs font-semibold text-muted">{t("howBooked")}</p>
      <div className="flex flex-wrap gap-2">
        {units.map((unit) => (
          <Chip key={unit} on={Boolean(priceOf(unit))} onToggle={() => toggleUnit(unit)}>
            {tListings(`unitName.${unit}`)}
          </Chip>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {units
          .filter((unit) => priceOf(unit))
          .map((unit) => (
            <Field
              key={unit}
              label={`${t("price")} ${tListings(`perUnit.${unit}`)}`}
              type="number"
              min={0}
              value={priceOf(unit)?.price || ""}
              onChange={(e) => setPrice(unit, Number(e.target.value) || 0)}
            />
          ))}
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

/** The room type's photos: upload straight to our Cloudinary folder, remove, saved with the room. */
function RoomPhotos({ listingId, photos, onChange }: { listingId: string; photos: string[]; onChange: (photos: string[]) => void }) {
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
      <p className="text-xs font-semibold text-muted">{t("photos")}</p>
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
