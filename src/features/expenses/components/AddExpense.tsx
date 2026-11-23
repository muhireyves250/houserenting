"use client";

import { Select } from "@/components/ui/Select";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { addExpenseAction } from "../actions";

const CATEGORIES = ["SALARIES", "RENT", "MARKETING", "TRANSPORT", "INTERNET", "SOFTWARE", "FEES", "OTHER"] as const;

/** Add an expense in one line: date, kind, what it was, how much (and a receipt number if there is one). */
export function AddExpense() {
  const t = useTranslations("Expenses");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ spentOn: new Date().toISOString().slice(0, 10), category: "OTHER", description: "", amount: "", reference: "" });
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const field = "min-w-0 rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-primary";
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 self-start rounded-full bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-hover">
        <Plus className="size-4" aria-hidden="true" />
        {t("add")}
      </button>
    );
  return (
    <div className="grid gap-2 rounded-2xl bg-surface p-4 ring-1 ring-line sm:grid-cols-2 lg:grid-cols-5">
      <input className={field} type="date" aria-label={t("date")} value={form.spentOn} onChange={(e) => setForm({ ...form, spentOn: e.target.value })} />
      <Select className={field} aria-label={t("category")} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {t(`cat.${c}`)}
          </option>
        ))}
      </Select>
      <input className={`${field} lg:col-span-2`} placeholder={t("description")} aria-label={t("description")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <input className={field} inputMode="numeric" placeholder={t("amount")} aria-label={t("amount")} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/\D/g, "") })} />
      <input className={`${field} lg:col-span-2`} placeholder={t("reference")} aria-label={t("reference")} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
      {error && <p className="text-[13px] font-medium text-danger lg:col-span-5">{t("invalid")}</p>}
      <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3">
        <button type="button" onClick={() => setOpen(false)} className="rounded-full px-4 py-2 text-[13px] font-semibold text-ink hover:bg-canvas">
          {t("cancel")}
        </button>
        <button
          type="button"
          disabled={pending || !form.description.trim() || !form.amount}
          onClick={() =>
            start(async () => {
              const r = await addExpenseAction({ ...form, amount: Number(form.amount) });
              setError(!r.ok);
              if (r.ok) {
                setOpen(false);
                setForm({ ...form, description: "", amount: "", reference: "" });
                router.refresh();
              }
            })
          }
          className="rounded-full bg-primary px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {t("save")}
        </button>
      </div>
    </div>
  );
}
