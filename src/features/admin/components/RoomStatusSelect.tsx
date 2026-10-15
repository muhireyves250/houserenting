"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { setRoomStatusAction } from "@/features/rooms/actions";
import { ROOM_STATUSES, type RoomStatus } from "@/features/rooms/validation";
import { useRouter } from "@/i18n/navigation";

/** Reception / staff: mark a room available, under repair, not offered, or being cleaned. */
export function RoomStatusSelect({ roomId, status, name }: { roomId: string; status: RoomStatus; name: string }) {
  const t = useTranslations("Rooms");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select
      aria-label={`${t("status")}: ${name}`}
      value={status}
      disabled={pending}
      onChange={(e) =>
        start(async () => {
          await setRoomStatusAction(roomId, e.target.value as RoomStatus);
          router.refresh();
        })
      }
      className="cursor-pointer rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-[13px] font-semibold text-ink disabled:opacity-50"
    >
      {ROOM_STATUSES.map((s) => (
        <option key={s} value={s}>
          {t(`statuses.${s}`)}
        </option>
      ))}
    </select>
  );
}
