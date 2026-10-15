"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { AreaField, Card, Chip, Field } from "@/features/hosting/components/fields";
import { FACILITIES } from "@/features/hosting/validation";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { removeRoomAction, saveRoomAction, setRoomStatusAction } from "../actions";
import { ROOM_STATUSES, type RoomInput, type RoomStatus } from "../validation";

type Room = RoomInput & { id: string; status: RoomStatus };

const EMPTY: RoomInput = { name: "", description: "", maxGuests: 2, nightlyPrice: 0, facilities: [] };

const STATUS_TONE: Record<RoomStatus, string> = {
  AVAILABLE: "text-emerald-700",
  MAINTENANCE: "text-amber-700",
  UNAVAILABLE: "text-muted",
  CLEANING: "text-primary",
};

/** Rooms of a place that rents by the room: each with its own price, guests, amenities and status. */
export function RoomsEditor({ listingId, rooms }: { listingId: string; rooms: Room[] }) {
  const t = useTranslations("Rooms");
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
              <RoomForm initial={room} pending={pending} onCancel={() => setEditing(null)} onSave={(input) => run(() => saveRoomAction(listingId, room.id, input), () => setEditing(null))} />
            </li>
          ) : (
            <li key={room.id} className="flex flex-col gap-3 rounded-2xl border border-line p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-ink">{room.name}</p>
                <p className="text-[13px] text-muted">
                  {formatRWF(room.nightlyPrice, locale)} · {t("guests", { count: room.maxGuests })}
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
          <RoomForm initial={EMPTY} pending={pending} onCancel={rooms.length > 0 ? () => setEditing(null) : undefined} onSave={(input) => run(() => saveRoomAction(listingId, null, input), () => setEditing(null))} />
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

function RoomForm({ initial, pending, onSave, onCancel }: { initial: RoomInput; pending: boolean; onSave: (input: RoomInput) => void; onCancel?: () => void }) {
  const t = useTranslations("Rooms");
  const tFacility = useTranslations("Facility");
  const [room, setRoom] = useState<RoomInput>(initial);
  const set = <K extends keyof RoomInput>(key: K, value: RoomInput[K]) => setRoom((r) => ({ ...r, [key]: value }));
  const valid = room.name.trim().length >= 2 && room.nightlyPrice >= 100 && room.maxGuests >= 1;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-primary/[0.02] p-4">
      <Field label={t("name")} value={room.name} maxLength={60} onChange={(e) => set("name", e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("price")} type="number" min={0} value={room.nightlyPrice || ""} onChange={(e) => set("nightlyPrice", Number(e.target.value) || 0)} />
        <Field label={t("maxGuests")} type="number" min={1} value={room.maxGuests || ""} onChange={(e) => set("maxGuests", Number(e.target.value) || 0)} />
      </div>
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
