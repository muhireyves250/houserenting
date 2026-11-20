import { ShieldCheck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { VerifyPayoutButton } from "./AdminPlaceSettings";

/** Owners' payout details that are new or changed: staff check them (full number shown) and mark them verified. */
export async function PayoutChecks() {
  const [t, tPromoters, locale, rows] = await Promise.all([
    getTranslations("Money.payoutCheck"),
    getTranslations("Promoters"),
    getLocale(),
    db.payoutAccount.findMany({
      where: { verifiedAt: null },
      orderBy: { updatedAt: "asc" },
      select: { method: true, accountName: true, accountNumber: true, bankName: true, updatedAt: true, user: { select: { id: true, name: true, email: true, phone: true } } },
    }),
  ]);
  if (rows.length === 0) return null;
  return (
    <section id="payout-checks" className="flex scroll-mt-24 flex-col gap-3">
      <h2 className="flex items-center gap-2 text-[17px] font-bold text-ink">
        <ShieldCheck className="size-5 text-amber-600" aria-hidden="true" />
        {t("title")} <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[12px] text-amber-900">{rows.length}</span>
      </h2>
      <p className="-mt-2 text-[13px] text-muted">{t("hint")}</p>
      <ul className="grid gap-3 lg:grid-cols-2">
        {rows.map((r) => (
          <li key={r.user.id} className="flex flex-col gap-3 rounded-2xl bg-surface p-4 ring-1 ring-amber-200">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <Link href={`/admin/users/${r.user.id}`} className="block truncate text-[15px] font-bold text-ink hover:text-primary">
                  {r.user.name}
                </Link>
                <span className="block truncate text-[12px] text-muted">{[r.user.phone, r.user.email].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="shrink-0 text-[12px] text-muted">{formatKigaliDateTime(locale, r.updatedAt)}</span>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-canvas px-3 py-2.5 text-[13px]">
              <dt className="text-muted">{t("method")}</dt>
              <dd className="font-semibold text-ink">
                {tPromoters(`method.${r.method}`)}
                {r.bankName ? ` · ${r.bankName}` : ""}
              </dd>
              <dt className="text-muted">{t("name")}</dt>
              <dd className="font-semibold text-ink">{r.accountName}</dd>
              <dt className="text-muted">{t("number")}</dt>
              <dd className="font-mono font-semibold text-ink">{r.accountNumber}</dd>
            </dl>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] text-muted">{t("checkFirst")}</span>
              <VerifyPayoutButton userId={r.user.id} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
