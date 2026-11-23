import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PayoutForm } from "@/features/admin/components/MoneyControls";
import { PageIntro, Panel } from "@/features/admin/components/ui";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { providerStatement } from "@/features/ledger/service";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import { formatRWF } from "@/lib/format";
import { requireStaff } from "@/lib/permissions";

type Props = { params: Promise<{ id: string }> };

/**
 * One owner's or provider's money account (requirements 5.5): what their guests paid, VIIPA's commission, what is due
 * now and after stays, what was paid (dates and references), and every money movement.
 */
export default async function ProviderStatementPage({ params }: Props) {
  const { id } = await params;
  await requireStaff("money", `/admin/money/providers/${id}`);
  const person = await db.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, phone: true } });
  if (!person) notFound();
  const [t, tMoney, locale, s] = await Promise.all([getTranslations("Money.statement"), getTranslations("Money"), getLocale(), providerStatement(id)]);
  const rwf = (n: number) => formatRWF(n, locale);
  const tiles: [string, number, string][] = [
    [t("transactions"), s.transactions, "text-ink"],
    [t("commission"), s.commission, "text-ink"],
    [t("dueNow"), s.due, "text-primary"],
    [t("dueLater"), s.upcoming, "text-ink"],
    [t("paid"), s.paidOut, "text-emerald-700"],
  ];
  return (
    <div className="flex flex-col gap-5">
      <PageIntro back={{ href: "/admin/money", label: tMoney("title") }} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface p-5 ring-1 ring-line">
        <div className="min-w-0">
          <Link href={`/admin/users/${person.id}`} className="block truncate text-[18px] font-bold text-ink hover:text-primary">
            {person.name}
          </Link>
          <p className="truncate text-[13px] text-muted">{[person.email, person.phone].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map(([label, value, tone]) => (
          <div key={label} className="rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
            <dt className="text-[12px] font-semibold text-muted">{label}</dt>
            <dd className={cn("text-[18px] font-bold tabular-nums", tone)}>{rwf(value)}</dd>
          </div>
        ))}
      </dl>
      {s.due > 0 && (
        <Panel title={t("payNow")}>
          <PayoutForm hostId={person.id} due={s.due} />
        </Panel>
      )}
      <Panel title={t("payouts")} flush>
        {s.payouts.length === 0 ? (
          <p className="px-5 py-5 text-[14px] text-muted">{t("noPayouts")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {s.payouts.map((p) => (
              <li key={p.reference} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-[13px]">
                <span className="font-mono font-semibold text-ink">{p.reference}</span>
                <span className="text-muted">{formatKigaliDateTime(locale, p.createdAt)}</span>
                <span className="min-w-0 flex-1 truncate text-muted">
                  {p.method}
                  {p.externalReference ? ` · ${p.externalReference}` : ""}
                </span>
                <span className="font-bold text-emerald-700 tabular-nums">{rwf(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title={t("history")} flush>
        {s.entries.length === 0 ? (
          <p className="px-5 py-5 text-[14px] text-muted">{tMoney("nothing")}</p>
        ) : (
          <div className="overflow-x-auto" data-lenis-prevent>
            <table className="w-full text-[13px]">
              <thead className="text-left text-[12px] text-muted">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">{t("date")}</th>
                  <th className="px-5 py-2.5 font-semibold">{t("what")}</th>
                  <th className="px-5 py-2.5 font-semibold">{t("reference")}</th>
                  <th className="px-5 py-2.5 text-right font-semibold">{t("amount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {s.entries.map((e) => (
                  <tr key={e.id}>
                    <td className="px-5 py-2.5 whitespace-nowrap text-muted">{formatKigaliDateTime(locale, e.createdAt)}</td>
                    <td className="px-5 py-2.5">{tMoney(`kind.${e.kind}`)}</td>
                    <td className="px-5 py-2.5 font-mono text-[12px]">{e.booking?.reference ?? e.settlement?.reference ?? e.note ?? "—"}</td>
                    <td className="px-5 py-2.5 text-right font-semibold tabular-nums">{rwf(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
