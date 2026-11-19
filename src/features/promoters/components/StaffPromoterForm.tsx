"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { AreaField, Field, SelectField } from "@/features/hosting/components/fields";
import { useRouter } from "@/i18n/navigation";
import { staffAddPromoterAction, staffEditPromoterAction } from "../actions";
import type { PromoterInput } from "../service";

const EMPTY: PromoterInput = { about: "", payoutMethod: "MOBILE_MONEY", payoutName: "", payoutNumber: "", bankName: null };

/** Staff add a promoter (by the person's account email) or edit one: where they promote and where rewards go. */
export function StaffPromoterForm({ promoterId, initial, onDone }: { promoterId?: string; initial?: PromoterInput; onDone: () => void }) {
  const t = useTranslations("Promoters");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [form, setForm] = useState<PromoterInput>(initial ?? EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof PromoterInput>(k: K, v: PromoterInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const save = () =>
    start(async () => {
      setError(null);
      const result = promoterId ? await staffEditPromoterAction(promoterId, form) : await staffAddPromoterAction(email, form);
      if (result.ok) {
        onDone();
        router.refresh();
      } else setError("error" in result ? t(`staffError.${result.error}`) : t("checkField"));
    });
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-canvas p-3">
      {!promoterId && <Field label={t("staffEmail")} type="email" value={email} maxLength={200} placeholder="name@example.com" onChange={(e) => setEmail(e.target.value)} />}
      <AreaField label={t("about")} rows={2} maxLength={500} value={form.about ?? ""} onChange={(e) => set("about", e.target.value)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label={t("payoutMethod")} value={form.payoutMethod} onChange={(e) => set("payoutMethod", e.target.value as PromoterInput["payoutMethod"])}>
          <option value="MOBILE_MONEY">{t("method.MOBILE_MONEY")}</option>
          <option value="BANK">{t("method.BANK")}</option>
        </SelectField>
        <Field label={t("payoutName")} value={form.payoutName} maxLength={100} onChange={(e) => set("payoutName", e.target.value)} />
        <Field label={form.payoutMethod === "BANK" ? t("accountNumber") : t("momoNumber")} value={form.payoutNumber} maxLength={40} onChange={(e) => set("payoutNumber", e.target.value)} />
        {form.payoutMethod === "BANK" && <Field label={t("bankName")} value={form.bankName ?? ""} maxLength={80} onChange={(e) => set("bankName", e.target.value || null)} />}
      </div>
      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded-full px-4 py-2 text-[13px] font-semibold text-ink hover:bg-surface">
          {t("cancel")}
        </button>
        <button type="button" disabled={pending} onClick={save} className="rounded-full bg-primary px-5 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-60">
          {promoterId ? t("saveChanges") : t("addPromoter")}
        </button>
      </div>
    </div>
  );
}

/** "Add a promoter" button that opens the form in place. */
export function AddPromoter() {
  const t = useTranslations("Promoters");
  const [open, setOpen] = useState(false);
  return open ? (
    <StaffPromoterForm onDone={() => setOpen(false)} />
  ) : (
    <button type="button" onClick={() => setOpen(true)} className="self-start rounded-full bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-hover">
      + {t("addPromoter")}
    </button>
  );
}

/** "Edit" for one promoter, opening the form under their card. */
export function EditPromoter({ promoterId, initial }: { promoterId: string; initial: PromoterInput }) {
  const t = useTranslations("Promoters");
  const [open, setOpen] = useState(false);
  return open ? (
    <div className="basis-full">
      <StaffPromoterForm promoterId={promoterId} initial={initial} onDone={() => setOpen(false)} />
    </div>
  ) : (
    <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-line px-3.5 py-1.5 text-[13px] font-semibold text-ink hover:border-primary">
      {t("edit")}
    </button>
  );
}
