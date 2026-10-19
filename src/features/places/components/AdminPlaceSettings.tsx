"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useRouter } from "@/i18n/navigation";
import { updatePlaceAdminAction, verifyPayoutAction } from "../actions";

const input = "w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-primary";

/** Staff-only: the management agreement dates, home-page highlight, who operates the place. */
export function AdminPlaceSettings({
  listingId,
  initial,
}: {
  listingId: string;
  initial: { contractStart: string | null; contractEnd: string | null; featured: boolean; operator: "OWNER" | "VIIPA"; keepVisible: boolean };
}) {
  const t = useTranslations("Places");
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {t("contractStart")}
          <input type="date" value={form.contractStart ?? ""} onChange={(e) => setForm({ ...form, contractStart: e.target.value || null })} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {t("contractEnd")}
          <input type="date" value={form.contractEnd ?? ""} min={form.contractStart ?? undefined} onChange={(e) => setForm({ ...form, contractEnd: e.target.value || null })} className={input} />
        </label>
      </div>
      <p className="text-xs text-muted">{t("contractHint")}</p>
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
        {t("operator")}
        <select value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value as "OWNER" | "VIIPA" })} className={input}>
          <option value="OWNER">{t("operatorOwner")}</option>
          <option value="VIIPA">{t("operatorViipa")}</option>
        </select>
      </label>
      <label className="flex cursor-pointer items-center gap-3 text-[14px] text-ink">
        <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="size-5 accent-[var(--color-primary)]" />
        {t("featured")}
      </label>
      <label className="flex cursor-pointer items-center gap-3 text-[14px] text-ink">
        <input type="checkbox" checked={form.keepVisible} onChange={(e) => setForm({ ...form, keepVisible: e.target.checked })} className="size-5 accent-[var(--color-primary)]" />
        {t("keepVisible")}
      </label>
      <div className="flex items-center justify-end gap-3">
        {message && <span className={message.ok ? "text-[13px] text-emerald-700" : "text-[13px] text-danger"}>{message.text}</span>}
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              const result = await updatePlaceAdminAction(listingId, form);
              setMessage({ ok: result.ok, text: result.ok ? t("saved") : t("contractDatesError") });
              if (result.ok) router.refresh();
            })
          }
        >
          {t("save")}
        </Button>
      </div>
    </div>
  );
}

export function VerifyPayoutButton({ userId }: { userId: string }) {
  const t = useTranslations("Places");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="md"
      loading={pending}
      onClick={() =>
        start(async () => {
          await verifyPayoutAction(userId);
          router.refresh();
        })
      }
    >
      {t("verifyPayout")}
    </Button>
  );
}
