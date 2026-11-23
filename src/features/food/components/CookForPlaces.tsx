"use client";

import { Clock, Home, Send, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { useRouter } from "@/i18n/navigation";
import { applyToCookAction } from "../actions";

type Place = { id: string; title: string; city: string };
type Request = { id: string; status: "PENDING" | "APPROVED" | "DECLINED"; reason: string | null; listing: Place };

/** The places a restaurant cooks for, its applications (waiting, declined) and applying for another place. */
export function CookForPlaces({ restaurantId, serving, requests, options }: { restaurantId: string; serving: Place[]; requests: Request[]; options: Place[] }) {
  const t = useTranslations("Food.cookFor");
  const router = useRouter();
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const waiting = requests.filter((r) => r.status === "PENDING");
  const declined = requests.filter((r) => r.status === "DECLINED").slice(0, 5);

  const apply = () =>
    start(async () => {
      const r = await applyToCookAction(restaurantId, place, note);
      setMessage(r.ok ? { ok: true, text: t("sent") } : { ok: false, text: t(`error.${r.error}`) });
      if (r.ok) {
        setPlace("");
        setNote("");
        router.refresh();
      }
    });

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-[15px] font-bold text-ink">{t("serving")}</h3>
        {serving.length === 0 ? (
          <p className="text-[14px] text-muted">{t("servingNone")}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {serving.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
                <Home className="size-5 shrink-0 text-emerald-700" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold text-ink">{p.title}</span>
                  <span className="block text-[12px] text-muted">{p.city}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(waiting.length > 0 || declined.length > 0) && (
        <section className="flex flex-col gap-2">
          <h3 className="text-[15px] font-bold text-ink">{t("applications")}</h3>
          <ul className="flex flex-col gap-2">
            {[...waiting, ...declined].map((r) => (
              <li key={r.id} className="flex items-start gap-3 rounded-2xl bg-canvas p-3">
                {r.status === "PENDING" ? <Clock className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />}
                <span className="min-w-0 text-[14px]">
                  <b className="font-semibold text-ink">{r.listing.title}</b> <span className="text-muted">· {r.listing.city}</span>
                  <span className={r.status === "PENDING" ? "block text-[13px] text-amber-800" : "block text-[13px] text-danger"}>{r.status === "PENDING" ? t("waiting") : t("declined", { reason: r.reason ?? "" })}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Apply for another place. */}
      <section className="flex flex-col gap-3 rounded-2xl bg-canvas p-4">
        <h3 className="text-[15px] font-bold text-ink">{t("applyTitle")}</h3>
        <p className="-mt-2 text-[13px] text-muted">{t("applyHint")}</p>
        <Select aria-label={t("choosePlace")} value={place} onChange={(e) => setPlace(e.target.value)} className="h-12 w-full rounded-xl border border-line-strong bg-surface px-4 text-[15px] text-ink">
          <option value="">{t("choosePlace")}</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} · {p.city}
            </option>
          ))}
        </Select>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder={t("notePlaceholder")} aria-label={t("notePlaceholder")} className="rounded-xl border border-line-strong bg-surface px-4 py-3 text-[15px] text-ink outline-none focus:border-primary" />
        <button type="button" disabled={!place || pending} onClick={apply} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
          <Send className="size-4" aria-hidden="true" />
          {t("apply")}
        </button>
        {message && <p className={message.ok ? "text-[14px] font-medium text-emerald-700" : "text-[14px] font-medium text-danger"}>{message.text}</p>}
      </section>
    </div>
  );
}
