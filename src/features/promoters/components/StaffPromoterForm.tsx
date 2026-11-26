"use client";

import { PersonPicker } from "@/features/admin/components/PersonPicker";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { AreaField, Field, SelectField } from "@/features/hosting/components/fields";
import { useRouter } from "@/i18n/navigation";
import { staffAddPromoterAction, staffEditPromoterAction } from "../actions";
import type { PromoterInput } from "../service";
import { CODE_FIELDS, EMPTY_CODE, FirstCodeFields, toFirstCode, type FirstCode } from "./FirstCodeFields";

const EMPTY: PromoterInput = { about: "", payoutMethod: "MOBILE_MONEY", payoutName: "", payoutNumber: "", bankName: null };

/** Staff add a promoter (by the person's account email) or edit one: where they promote and where rewards go. */
export function StaffPromoterForm({ promoterId, initial, period: initialPeriod = null, onDone }: { promoterId?: string; initial?: PromoterInput; period?: { startsOn: string; endsOn: string } | null; onDone: () => void }) {
  const t = useTranslations("Promoters");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [form, setForm] = useState<PromoterInput>(initial ?? EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<FirstCode>(EMPTY_CODE);
  const [codeErrors, setCodeErrors] = useState<Record<string, string>>({});
  // Editing: their period (from–until), changed here.
  const [period, setPeriod] = useState(initialPeriod ?? { startsOn: "", endsOn: "" });
  const [pending, start] = useTransition();
  const set = <K extends keyof PromoterInput>(k: K, v: PromoterInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const save = () =>
    start(async () => {
      setError(null);
      setCodeErrors({});
      const result = promoterId
        ? await staffEditPromoterAction(promoterId, form, period.startsOn && period.endsOn ? period : null)
        : await staffAddPromoterAction(email, form, toFirstCode(code));
      if (result.ok) {
        onDone();
        router.refresh();
      } else if ("errors" in result && promoterId && "endsOn" in result.errors) setError(t("periodError"));
      else if ("errors" in result && CODE_FIELDS.some((k) => k in result.errors)) setCodeErrors(result.errors);
      else setError("error" in result ? t(`staffError.${result.error}`) : t("checkField"));
    });
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-canvas p-3">
      {/* Choose the person from everyone with an account (search by name or email). */}
      {!promoterId && <PersonPicker label={t("staffEmail")} onChange={setEmail} />}
      {/* Every new promoter gets their own promo code with their share. */}
      {!promoterId && <FirstCodeFields value={code} onChange={setCode} errors={codeErrors} periodHint={t("periodFromCode")} />}
      {promoterId && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("periodFrom")} type="date" value={period.startsOn} onChange={(e) => setPeriod((p) => ({ ...p, startsOn: e.target.value }))} />
          <Field label={t("periodUntil")} type="date" min={period.startsOn || undefined} value={period.endsOn} onChange={(e) => setPeriod((p) => ({ ...p, endsOn: e.target.value }))} />
        </div>
      )}
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
export function EditPromoter({ promoterId, initial, period = null }: { promoterId: string; initial: PromoterInput; period?: { startsOn: string; endsOn: string } | null }) {
  const t = useTranslations("Promoters");
  const [open, setOpen] = useState(false);
  return open ? (
    <div className="basis-full">
      <StaffPromoterForm promoterId={promoterId} initial={initial} period={period} onDone={() => setOpen(false)} />
    </div>
  ) : (
    <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-line px-3.5 py-1.5 text-[13px] font-semibold text-ink hover:border-primary">
      {t("edit")}
    </button>
  );
}
