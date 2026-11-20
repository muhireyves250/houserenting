import { DownloadLink } from "@/components/ui/DownloadLink";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { SendReceiptButton } from "@/features/receipt/components/SendReceiptButton";
import { paymentReceipt } from "@/features/receipt/payment-receipt";
import { Link } from "@/i18n/navigation";
import { requireStaff } from "@/lib/permissions";

type Props = { params: Promise<{ paymentId: string }> };

/**
 * One transaction's receipt, for staff to download as PDF or send to the client's chat: the business details from
 * Money → Receipt, who paid for which stay, how much, how and when.
 */
export default async function PaymentReceiptPage({ params }: Props) {
  const { paymentId } = await params;
  await requireStaff("money", `/admin/receipts/${paymentId}`);
  const locale = await getLocale();
  const [r, t, tMoney] = await Promise.all([
    paymentReceipt(paymentId, locale),
    getTranslations("Money.receipt"),
    getTranslations("Money"),
  ]);
  if (!r) notFound();
  const paid = r.payment.status === "SUCCEEDED";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/money"
          className="text-[13px] font-semibold text-primary hover:underline"
        >
          ← {tMoney("title")}
        </Link>
        {paid && (
          <span className="flex flex-wrap items-center gap-2">
            <SendReceiptButton paymentId={r.payment.id} />
            <DownloadLink
              href={`/api/v1/receipts/${r.payment.id}?lang=${locale}`}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-3.5 py-1 text-[12px] font-semibold text-white hover:bg-primary-hover"
            >
              {t("download")}
            </DownloadLink>
          </span>
        )}
      </div>
      <article className="rounded-2xl border border-line bg-surface p-6">
        <div className="text-center">
          <p className="text-[16px] font-bold text-ink">{r.businessName}</p>
          {r.headerLines.map((line) => (
            <p key={line} className="text-[12px] text-muted">
              {line}
            </p>
          ))}
        </div>
        <h1 className="mt-5 border-y border-dashed border-line py-3 text-center text-[15px] font-bold tracking-wide text-ink uppercase">
          {r.title}
        </h1>
        <dl className="mt-3 flex flex-col divide-y divide-line text-[13px]">
          {r.rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex items-baseline justify-between border-t-2 border-ink pt-3">
          <span className="text-[14px] font-bold text-ink">
            {r.amountLabel}
          </span>
          <span className="text-[20px] font-bold text-ink tabular-nums">
            {r.amount}
          </span>
        </div>
        {r.footer && (
          <p className="mt-5 border-t border-dashed border-line pt-3 text-center text-[12px] text-muted">
            {r.footer}
          </p>
        )}
      </article>
    </div>
  );
}
