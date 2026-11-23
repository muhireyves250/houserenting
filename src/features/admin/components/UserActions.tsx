"use client";

import { Ban, ChevronDown, KeyRound, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { deleteUserAction, sendPasswordResetAction } from "../actions";
import { setUserStatusAction } from "../moderation-actions";

type Dialog = "reset" | "suspend" | "reactivate" | "delete" | null;

/**
 * What staff can do with an account: manage its role and permissions (its page), send a password reset link,
 * suspend or reactivate it (with a reason), and delete it when it has no history. Each asks before it acts.
 */
export function UserActions({ user, self, inline = false }: { user: { id: string; name: string; status: string }; self: boolean; inline?: boolean }) {
  const t = useTranslations("Admin.userActions");
  const tMenu = useTranslations("Admin.actionsMenu");
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  // The menu floats above the list (so the list's edge can't cut it off), opening upwards near the bottom.
  const [at, setAt] = useState<{ top?: number; bottom?: number; right: number }>({ right: 0 });
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const suspended = user.status === "SUSPENDED";

  useEffect(() => {
    if (!menu) return;
    const away = (e: PointerEvent) => box.current && !box.current.contains(e.target as Node) && setMenu(false);
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [menu]);

  const open = (d: Dialog) => {
    setMenu(false);
    setReason("");
    setMessage(null);
    setDialog(d);
  };

  const run = () =>
    start(async () => {
      if (dialog === "reset") {
        const r = await sendPasswordResetAction(user.id);
        setMessage({ ok: r.ok, text: r.ok ? t("resetSent") : t(`error.${r.error}`) });
      } else if (dialog === "suspend" || dialog === "reactivate") {
        const r = await setUserStatusAction(user.id, dialog === "suspend" ? "SUSPENDED" : "ACTIVE", reason);
        setMessage({ ok: r.ok, text: r.ok ? t(dialog === "suspend" ? "suspended" : "reactivated") : t("error.failed") });
        if (r.ok) router.refresh();
      } else if (dialog === "delete") {
        const r = await deleteUserAction(user.id);
        setMessage({ ok: r.ok, text: r.ok ? t("deleted") : t(`error.${r.error}`) });
        if (r.ok) router.refresh();
      }
    });

  const item = "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[14px] text-ink hover:bg-primary/[0.06]";
  const items = (
    <>
      {!inline && (
        <Link href={`/admin/users/${user.id}`} className={item} onClick={() => setMenu(false)}>
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          {t("manage")}
        </Link>
      )}
      <button type="button" className={item} onClick={() => open("reset")}>
        <KeyRound className="size-4 text-primary" aria-hidden="true" />
        {t("reset")}
      </button>
      {suspended ? (
        <button type="button" className={item} onClick={() => open("reactivate")}>
          <RotateCcw className="size-4 text-emerald-700" aria-hidden="true" />
          {t("reactivate")}
        </button>
      ) : (
        <button type="button" className={item} onClick={() => open("suspend")}>
          <Ban className="size-4 text-amber-700" aria-hidden="true" />
          {t("suspend")}
        </button>
      )}
      <button type="button" className={cn(item, "text-red-700 hover:bg-red-50")} onClick={() => open("delete")}>
        <Trash2 className="size-4" aria-hidden="true" />
        {t("delete")}
      </button>
    </>
  );

  if (self) return inline ? null : <span className="text-[12px] text-muted">{t("you")}</span>;

  return (
    <div ref={box} className="relative">
      {inline ? (
        <div className="flex flex-col gap-0.5">{items}</div>
      ) : (
        <>
          <button
            type="button"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const up = window.innerHeight - r.bottom < 240;
              setAt(up ? { bottom: window.innerHeight - r.top + 4, right: window.innerWidth - r.right } : { top: r.bottom + 4, right: window.innerWidth - r.right });
              setMenu(!menu);
            }}
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label={t("menu", { name: user.name })}
            className={cn("inline-flex items-center gap-1 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors", menu ? "border-primary text-primary" : "border-line text-ink hover:border-primary")}
          >
            {tMenu("label")}
            <ChevronDown className={cn("size-3.5 transition-transform", menu && "rotate-180")} aria-hidden="true" />
          </button>
          {menu && (
            <div role="menu" style={at} className="fixed z-50 w-60 rounded-2xl text-left border border-line bg-surface p-1.5 shadow-[0_18px_40px_-16px_rgba(16,24,40,0.45)]">
              {items}
            </div>
          )}
        </>
      )}

      {dialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={t(`${dialog}Title`, { name: user.name })}>
          <div aria-hidden="true" onClick={() => !pending && setDialog(null)} className="absolute inset-0 bg-[#00142e]/45 backdrop-blur-[2px]" />
          <div className="relative flex w-full max-w-md flex-col gap-4 rounded-3xl bg-surface p-6 text-left shadow-[0_30px_80px_-20px_rgba(0,20,46,0.55)]">
            <h2 className="text-[18px] font-bold text-ink">{t(`${dialog}Title`, { name: user.name })}</h2>
            <p className="text-[14px] text-muted">{t(`${dialog}Body`)}</p>
            {dialog === "suspend" && (
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
                rows={3}
                placeholder={t("reason")}
                className="rounded-2xl border border-line-strong bg-surface px-3 py-2.5 text-[14px] text-ink outline-none focus:border-primary"
              />
            )}
            {message && <p role="status" className={cn("rounded-xl px-3 py-2 text-[13px]", message.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800")}>{message.text}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDialog(null)} className="rounded-full px-4 py-2 text-[14px] font-semibold text-ink hover:bg-canvas">
                {message?.ok ? t("close") : t("cancel")}
              </button>
              {!message?.ok && (
                <button
                  type="button"
                  disabled={pending || (dialog === "suspend" && !reason.trim())}
                  onClick={run}
                  className={cn(
                    "rounded-full px-5 py-2 text-[14px] font-semibold text-white disabled:opacity-50",
                    dialog === "delete" || dialog === "suspend" ? "bg-danger hover:brightness-110" : "bg-primary hover:bg-primary-hover",
                  )}
                >
                  {t(`${dialog}Confirm`)}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
