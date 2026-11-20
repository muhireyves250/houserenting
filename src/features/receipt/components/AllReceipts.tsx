import { DownloadLink } from "@/components/ui/DownloadLink";
import { Eye } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Pagination, SearchBox } from "@/features/admin/components/ui";
import { formatKigaliDateTime } from "@/features/bookings/format";
import type { Prisma } from "@/generated/prisma/client";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatRWF } from "@/lib/format";
import { SendReceiptButton } from "./SendReceiptButton";

const PER_PAGE = 25;

/** Every receipt there is (one per payment received), newest first: open it, download the PDF or send it to the client. */
export async function AllReceipts({ q, page }: { q: string; page: number }) {
  const search = q.trim().slice(0, 100);
  const where: Prisma.PaymentWhereInput = {
    status: "SUCCEEDED",
    ...(search
      ? {
          OR: [
            { providerReference: { contains: search, mode: "insensitive" } },
            {
              booking: { reference: { contains: search, mode: "insensitive" } },
            },
            {
              booking: {
                guest: { name: { contains: search, mode: "insensitive" } },
              },
            },
            {
              booking: {
                listing: { title: { contains: search, mode: "insensitive" } },
              },
            },
          ],
        }
      : {}),
  };
  const [t, tAdmin, locale, total, rows] = await Promise.all([
    getTranslations("Money.receipt"),
    getTranslations("Admin"),
    getLocale(),
    db.payment.count({ where }),
    db.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        amount: true,
        createdAt: true,
        booking: {
          select: {
            reference: true,
            guest: { select: { name: true } },
            listing: { select: { title: true } },
          },
        },
      },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const href = (pg: number) =>
    `/admin/money?${new URLSearchParams({ tab: "receipt", ...(search ? { rq: search } : {}), rpage: String(pg) })}`;
  const btn =
    "inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-[12px] font-semibold text-ink hover:border-primary hover:text-primary";

  return (
    <section id="all-receipts" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-bold text-ink">{t("allTitle")}</h2>
          <p className="text-[13px] text-muted">
            {t("allHint", { count: total })}
          </p>
        </div>
        <SearchBox
          name="rq"
          value={search}
          placeholder={t("allSearch")}
          keep={{ tab: "receipt" }}
        />
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-surface px-4 py-8 text-center text-[14px] text-muted ring-1 ring-line">
          {tAdmin("nothingHere")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-ink">
                  <span className="font-mono text-[13px] text-primary">
                    {p.booking.reference}
                  </span>{" "}
                  · {p.booking.guest.name}
                </span>
                <span className="block truncate text-[12px] text-muted">
                  {p.booking.listing.title} ·{" "}
                  {formatKigaliDateTime(locale, p.createdAt)}
                </span>
              </span>
              <span className="text-[15px] font-bold text-ink tabular-nums">
                {formatRWF(p.amount, locale)}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/receipts/${p.id}`} className={btn}>
                  <Eye className="size-3.5" aria-hidden="true" />
                  {t("open")}
                </Link>
                <DownloadLink
                  href={`/api/v1/receipts/${p.id}?lang=${locale}`}
                  className={btn}
                >
                  PDF
                </DownloadLink>
                <SendReceiptButton paymentId={p.id} />
              </span>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={page}
        pages={pages}
        hrefFor={href}
        label={(pg, n) => tAdmin("pageOf", { page: pg, pages: n })}
      />
    </section>
  );
}
