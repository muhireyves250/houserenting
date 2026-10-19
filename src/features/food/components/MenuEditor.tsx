"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { deleteMenuItemAction, saveMenuItemAction } from "../actions";

type Item = { id: string; section: string; name: string; description: string; price: number; available: boolean };
const EMPTY = { section: "", name: "", description: "", price: 0, available: true };
const input = "w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-primary";

/** Add, edit, switch off or remove dishes; sections group them on the menu. */
export function MenuEditor({ restaurantId, items }: { restaurantId: string; items: Item[] }) {
  const t = useTranslations("Food");
  const locale = useLocale();
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const sections = [...new Set(items.map((i) => i.section).filter(Boolean))];

  const save = () =>
    start(async () => {
      const result = await saveMenuItemAction(restaurantId, editing, form);
      setError(!result.ok);
      if (result.ok) {
        setEditing(null);
        setForm(EMPTY);
        router.refresh();
      }
    });

  return (
    <div className="flex flex-col gap-4">
      {items.length === 0 ? (
        <p className="text-[14px] text-muted">{t("menuEmpty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
          {items.map((item) => (
            <li key={item.id} className={cn("flex items-center gap-3 px-3 py-2.5", !item.available && "opacity-60")}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-ink">{item.name}</span>
                <span className="block truncate text-xs text-muted">
                  {[item.section, formatRWF(item.price, locale), item.available ? null : t("unavailable")].filter(Boolean).join(" · ")}
                </span>
              </span>
              <button
                type="button"
                aria-label={t("editItem", { name: item.name })}
                onClick={() => {
                  setEditing(item.id);
                  setForm({ section: item.section, name: item.name, description: item.description, price: item.price, available: item.available });
                }}
                className="flex size-8 items-center justify-center rounded-full text-ink hover:bg-canvas"
              >
                <Pencil className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={t("deleteItem", { name: item.name })}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await deleteMenuItemAction(item.id);
                    router.refresh();
                  })
                }
                className="flex size-8 items-center justify-center rounded-full text-danger hover:bg-danger/5"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-2">
        <p className="text-[13px] font-semibold text-ink sm:col-span-2">{editing ? t("editDish") : t("addDish")}</p>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {t("dishName")}
          <input className={input} maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {t("price")}
          <input className={input} type="number" min={1} value={form.price || ""} onChange={(e) => setForm({ ...form, price: Number(e.target.value) || 0 })} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {t("section")}
          <input className={input} maxLength={40} list="menu-sections" placeholder={t("sectionHint")} value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
          <datalist id="menu-sections">
            {sections.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {t("dishDescription")}
          <input className={input} maxLength={300} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-[14px] text-ink sm:col-span-2">
          <input type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} className="size-4.5 accent-[var(--color-primary)]" />
          {t("availableNow")}
        </label>
        <div className="flex items-center justify-end gap-2 sm:col-span-2">
          {error && <span className="text-[13px] font-medium text-danger">{t("checkForm")}</span>}
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(EMPTY);
              }}
              className="rounded-full px-4 py-2 text-[13px] font-semibold text-muted"
            >
              {t("cancel")}
            </button>
          )}
          <button type="button" disabled={pending || form.name.trim().length < 2 || form.price < 1} onClick={save} className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
            {editing ? t("saveDish") : t("addDishButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
