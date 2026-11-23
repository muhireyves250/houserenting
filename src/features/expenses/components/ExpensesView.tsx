import { getLocale, getTranslations } from "next-intl/server";
import { ConfirmAction } from "@/features/admin/components/ConfirmAction";
import { formatRWF } from "@/lib/format";
import { deleteExpenseAction } from "../actions";
import { recentExpenses } from "../service";
import { AddExpense } from "./AddExpense";

/** VIIPA's operating expenses: add one in a line, see the latest with this month's total. */
export async function ExpensesView() {
  const [t, locale, rows] = await Promise.all([getTranslations("Expenses"), getLocale(), recentExpenses(100)]);
  const rwf = (n: number) => formatRWF(n, locale);
  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = rows.filter((e) => e.spentOn.toISOString().slice(0, 7) === month).reduce((n, e) => n + e.amount, 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-muted">
          {t("thisMonth")} <b className="text-[17px] text-ink tabular-nums">{rwf(thisMonth)}</b>
        </p>
      </div>
      <AddExpense />
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-surface py-6 text-center text-[14px] text-muted ring-1 ring-line">{t("none")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-2xl bg-surface ring-1 ring-line">
          {rows.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-[13px]">
              <span className="w-24 text-muted tabular-nums">{e.spentOn.toISOString().slice(0, 10)}</span>
              <span className="rounded-full bg-canvas px-2 py-0.5 text-[12px] font-semibold text-ink">{t(`cat.${e.category as "OTHER"}`)}</span>
              <span className="min-w-0 flex-1 truncate text-ink">
                {e.description}
                {e.reference && <span className="text-muted"> · {e.reference}</span>}
              </span>
              <span className="font-bold text-ink tabular-nums">{rwf(e.amount)}</span>
              <ConfirmAction label={t("delete")} question={t("deleteQuestion")} action={deleteExpenseAction.bind(null, e.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
