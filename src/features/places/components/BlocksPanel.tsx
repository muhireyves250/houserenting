"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { createBlockAction, endBlockAction } from "../actions";
import type { BlockKind } from "../blocks-service";

type Block = { id: string; kind: BlockKind; startsAt: Date; endsAt: Date | null; reason: string; room: string | null; endedAt: Date | null };

const input = "w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-primary";

/**
 * Maintenance, unavailable or booked-elsewhere periods for the whole place or one room, with a known or open end.
 * Active ones can be ended; past ones stay listed as history.
 */
export function BlocksPanel({ listingId, rooms, active, past }: { listingId: string; rooms: { id: string; name: string }[]; active: Block[]; past: Block[] }) {
  const t = useTranslations("Places");
  const locale = useLocale();
  const router = useRouter();
  const [form, setForm] = useState({ roomId: "", kind: "MAINTENANCE" as BlockKind, from: "", until: "", reason: "" });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Africa/Kigali" });
  const until = (b: Block) => (b.endsAt ? date.format(new Date(b.endsAt.getTime() - 1)) : t("untilFurtherNotice"));

  const add = () =>
    start(async () => {
      const result = await createBlockAction(listingId, { roomId: form.roomId || null, kind: form.kind, from: form.from, until: form.until || null, reason: form.reason });
      if (result.ok) {
        setForm({ ...form, from: "", until: "", reason: "" });
        setMessage({ ok: true, text: result.overlapping > 0 ? t("blockAddedWithBookings", { count: result.overlapping }) : t("blockAdded") });
        router.refresh();
      } else setMessage({ ok: false, text: t("blockFailed") });
    });

  return (
    <div className="flex flex-col gap-4">
      {active.length === 0 ? (
        <p className="text-[13px] text-muted">{t("noBlocks")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {active.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5">
              <span className="text-[14px] text-ink">
                <b className="font-semibold">{t(`blockKind.${b.kind}`)}</b> · {b.room ?? t("wholePlace")}
                <span className="block text-xs text-muted">
                  {date.format(b.startsAt)} → {until(b)} · {b.reason}
                </span>
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await endBlockAction(b.id);
                    router.refresh();
                  })
                }
                className="rounded-lg bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink ring-1 ring-line hover:ring-primary disabled:opacity-50"
              >
                {t("endBlock")}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-2">
        <p className="text-[13px] font-semibold text-ink sm:col-span-2">{t("addBlock")}</p>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {t("blockWhat")}
          <select value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })} className={input}>
            <option value="">{t("wholePlace")}</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {t("blockWhy")}
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as BlockKind })} className={input}>
            {(["MAINTENANCE", "UNAVAILABLE", "OFFLINE_BOOKING"] as const).map((k) => (
              <option key={k} value={k}>
                {t(`blockKind.${k}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {t("blockFrom")}
          <input type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {t("blockUntil")}
          <input type="date" value={form.until} min={form.from || undefined} onChange={(e) => setForm({ ...form, until: e.target.value })} className={input} />
          <span className="font-normal">{t("blockUntilHint")}</span>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted sm:col-span-2">
          {t("blockReason")}
          <input value={form.reason} maxLength={300} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={input} />
        </label>
        <div className="flex items-center justify-between gap-3 sm:col-span-2">
          <span role="status" className={message?.ok === false ? "text-[13px] font-medium text-danger" : "text-[13px] text-muted"}>
            {message?.text}
          </span>
          <button
            type="button"
            disabled={pending || !form.from || !form.reason.trim()}
            onClick={add}
            className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {t("addBlockButton")}
          </button>
        </div>
      </div>

      {past.length > 0 && (
        <details className="text-[13px]">
          <summary className="cursor-pointer font-semibold text-muted">{t("blockHistory", { count: past.length })}</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {past.map((b) => (
              <li key={b.id} className="text-muted">
                {t(`blockKind.${b.kind}`)} · {b.room ?? t("wholePlace")} · {date.format(b.startsAt)} → {b.endsAt ? date.format(new Date(b.endsAt.getTime() - 1)) : "—"} · {b.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
