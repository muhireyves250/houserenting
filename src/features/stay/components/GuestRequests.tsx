import { ArrowRight, CalendarDays, House, User } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { formatKigaliDateTime, formatStayDates } from "@/features/bookings/format";
import { pendingRefunds, pendingStayRequests } from "../service";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** What each kind of request looks like. */
const KIND_TONE: Record<string, string> = {
  EXTEND: "bg-emerald-100 text-emerald-800",
  SHORTEN: "bg-amber-100 text-amber-900",
  TRANSFER: "bg-primary/10 text-primary",
  CANCEL: "bg-red-50 text-red-700",
};

function Group({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-[17px] font-bold text-ink">
        {title}
        <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums", count > 0 ? "bg-primary text-white" : "bg-canvas text-muted")}>{count}</span>
      </h2>
      {children}
    </section>
  );
}

function Line({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-start gap-2 text-[13px] text-ink">
      <span className="mt-0.5 shrink-0 text-primary [&>svg]:size-4">{icon}</span>
      <span className="min-w-0">{children}</span>
    </span>
  );
}

const card = "flex flex-col gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line";
const open = "inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-hover";

/**
 * Staff, on the bookings page: guests' change and cancellation requests to answer and refunds to send, one card
 * each. Shows nothing when nothing waits.
 */
export async function GuestRequests() {
  const [t, tStay, locale, requests, refunds] = await Promise.all([getTranslations("Admin"), getTranslations("MyStay"), getLocale(), pendingStayRequests(), pendingRefunds()]);
  if (requests.length === 0 && refunds.length === 0) return null;
  const none = <p className="rounded-2xl bg-surface py-6 text-center text-[14px] text-muted ring-1 ring-line">{t("nothingHere")}</p>;
  return (
    <div className="mb-8 flex flex-col gap-6 rounded-3xl bg-primary/[0.04] p-4 ring-1 ring-primary/20 md:p-5">
      {requests.length > 0 && (
        <Group title={tStay("requestsTitle")} count={requests.length}>
          {requests.length === 0 ? (
            none
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {requests.map((r) => (
                <li key={r.id} className={card}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("rounded-full px-3 py-1 text-[13px] font-bold", KIND_TONE[r.kind] ?? "bg-canvas text-ink")}>{tStay(`kind.${r.kind}`)}</span>
                    <span className="text-[12px] text-muted">{formatKigaliDateTime(locale, r.createdAt)}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Line icon={<User />}>
                      <b className="font-semibold">{r.booking.guest.name}</b> · <span className="font-mono">{r.booking.reference}</span>
                    </Line>
                    <Line icon={<House />}>{r.booking.listing.title}</Line>
                    <Line icon={<CalendarDays />}>{formatStayDates(locale, iso(r.booking.checkIn), iso(r.booking.checkOut))}</Line>
                  </div>
                  {(r.transferTo ?? r.reason) && <p className="rounded-xl bg-canvas px-3 py-2 text-[13px] text-ink">{r.transferTo ?? r.reason}</p>}
                  <Link href={`/admin/bookings/${r.booking.reference}`} className={open}>
                    {t("openToAnswer")}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Group>
      )}
      {refunds.length > 0 && (
        <Group title={tStay("refundsTitle")} count={refunds.length}>
          {refunds.length === 0 ? (
            none
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {refunds.map((b) => (
                <li key={b.reference} className={card}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[15px] font-bold text-ink">{b.reference}</span>
                    <span className="text-[18px] font-bold text-ink tabular-nums">{formatRWF(b.refundAmount ?? 0, locale)}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Line icon={<User />}>
                      <b className="font-semibold">{b.guest.name}</b>
                    </Line>
                    <Line icon={<House />}>{b.listing.title}</Line>
                  </div>
                  <Link href={`/admin/bookings/${b.reference}`} className={open}>
                    {t("openToAnswer")}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Group>
      )}
    </div>
  );
}
