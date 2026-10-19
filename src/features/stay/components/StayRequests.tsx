"use client";

import { CalendarMinus, CalendarPlus, MapPinned, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { requestStayChangeAction, withdrawStayRequestAction } from "../actions";
import type { StayRequestKind } from "../rules";

type Request = { id: string; kind: StayRequestKind; status: string; reason: string; newCheckOut: Date | null; transferTo: string | null; priceChange: number | null; response: string | null; createdAt: Date };

const input = "w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-[15px] text-ink outline-none focus:border-primary";
const ICONS = { EXTEND: CalendarPlus, SHORTEN: CalendarMinus, TRANSFER: MapPinned, CANCEL: XCircle } as const;

/** Ask to stay longer, leave earlier, move to another place, or cancel; and follow earlier requests. */
export function StayRequests({
  reference,
  checkIn,
  checkOut,
  today,
  canCancel,
  paid,
  requests,
}: {
  reference: string;
  checkIn: string;
  checkOut: string;
  today: string;
  canCancel: boolean;
  paid: boolean;
  requests: Request[];
}) {
  const t = useTranslations("MyStay");
  const locale = useLocale();
  const router = useRouter();
  const kinds: StayRequestKind[] = ["EXTEND", "SHORTEN", "TRANSFER", ...(canCancel ? (["CANCEL"] as const) : [])];
  const [kind, setKind] = useState<StayRequestKind | null>(null);
  const [form, setForm] = useState({ reason: "", newCheckOut: "", transferTo: "" });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const waiting = requests.some((r) => r.status === "PENDING");
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
  const tomorrow = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

  const send = () =>
    start(async () => {
      if (!kind) return;
      const result = await requestStayChangeAction(reference, { kind, reason: form.reason, newCheckOut: form.newCheckOut || null, transferTo: form.transferTo || null });
      if (result.ok) {
        setKind(null);
        setForm({ reason: "", newCheckOut: "", transferTo: "" });
        setMessage({ ok: true, text: t("requestSent") });
        router.refresh();
      } else setMessage({ ok: false, text: t(`requestError.${result.error}`) });
    });

  return (
    <div className="flex flex-col gap-4">
      {!paid ? (
        <p className="text-[14px] text-muted">{t("requestsAfterPayment")}</p>
      ) : waiting ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-[14px] text-amber-900">{t("requestWaiting")}</p>
      ) : (
        <>
          <div className={cn("grid gap-2", kinds.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}>
            {kinds.map((k) => {
              const Icon = ICONS[k];
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => {
                    setKind(kind === k ? null : k);
                    setMessage(null);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 text-center text-[13px] font-semibold transition-colors",
                    kind === k ? "border-primary bg-primary/[0.06] text-primary" : "border-line bg-surface text-ink hover:border-primary/60",
                    k === "CANCEL" && kind !== k && "text-danger",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {t(`kind.${k}`)}
                </button>
              );
            })}
          </div>
          {kind && (
            <div className="flex flex-col gap-3 rounded-2xl border border-line p-4 motion-safe:animate-pop-in">
              <p className="text-[13px] text-muted">{t(`kindHint.${kind}`)}</p>
              {(kind === "EXTEND" || kind === "SHORTEN") && (
                <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                  {t("newCheckOut")}
                  <input
                    type="date"
                    className={input}
                    value={form.newCheckOut}
                    min={kind === "EXTEND" ? tomorrow(checkOut) : tomorrow(checkIn > today ? checkIn : today)}
                    max={kind === "SHORTEN" ? checkOut : undefined}
                    onChange={(e) => setForm({ ...form, newCheckOut: e.target.value })}
                  />
                </label>
              )}
              {kind === "TRANSFER" && (
                <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                  {t("transferTo")}
                  <input className={input} maxLength={120} placeholder={t("transferToHint")} value={form.transferTo} onChange={(e) => setForm({ ...form, transferTo: e.target.value })} />
                </label>
              )}
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                {t("why")}
                <textarea className={input} rows={2} maxLength={500} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </label>
              <button
                type="button"
                disabled={pending || form.reason.trim().length < 3}
                onClick={send}
                className={cn(
                  "self-end rounded-full px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50",
                  kind === "CANCEL" ? "bg-danger" : "bg-primary hover:bg-primary-hover",
                )}
              >
                {t(`send.${kind}`)}
              </button>
            </div>
          )}
        </>
      )}
      {message && (
        <p role="status" className={message.ok ? "text-[14px] font-medium text-emerald-700" : "text-[14px] font-medium text-danger"}>
          {message.text}
        </p>
      )}

      {requests.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-col gap-1 px-4 py-3">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[14px] font-semibold text-ink">
                  {t(`kind.${r.kind}`)}
                  {r.newCheckOut && ` · ${t("until", { date: date.format(r.newCheckOut) })}`}
                  {r.transferTo && ` · ${r.transferTo}`}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    r.status === "PENDING" && "bg-amber-50 text-amber-800",
                    r.status === "APPROVED" && "bg-emerald-50 text-emerald-800",
                    (r.status === "DECLINED" || r.status === "WITHDRAWN") && "bg-canvas text-muted",
                  )}
                >
                  {t(`requestStatus.${r.status as "PENDING"}`)}
                </span>
              </span>
              <span className="text-[13px] text-muted">{r.reason}</span>
              {r.response && <span className="text-[13px] text-ink">{t("staffReply", { text: r.response })}</span>}
              {r.status === "APPROVED" && r.priceChange !== null && r.priceChange > 0 && (
                <span className="text-[13px] font-semibold text-ink">{t("toPay", { amount: formatRWF(r.priceChange, locale) })}</span>
              )}
              {r.status === "PENDING" && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await withdrawStayRequestAction(r.id);
                      router.refresh();
                    })
                  }
                  className="self-start text-[13px] font-semibold text-primary hover:underline"
                >
                  {t("withdraw")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
