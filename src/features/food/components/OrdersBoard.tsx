"use client";

import { Select } from "@/components/ui/Select";

import { Bell, BedDouble, Bike, DoorOpen, CheckCircle2, Circle, MapPin, Navigation, Timer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { roomLabel } from "@/features/rooms/links";
import { formatRWF } from "@/lib/format";
import { ConfirmAction } from "@/features/admin/components/ConfirmAction";
import { assignCourierAction, confirmDeliveryAction, deleteFoodOrderAction, moveOrderAction, remindRestaurantAction } from "../actions";
import type { Fulfilment, OrderStatus } from "../rules";

export type BoardOrder = {
  reference: string;
  status: OrderStatus;
  fulfilment: Fulfilment;
  customer: string;
  phone: string;
  /** Where it goes (the guest's place and room), or the delivery address. */
  address: string | null;
  /** The restaurant it comes from (staff view). */
  kitchen?: string | null;
  note: string | null;
  total: number;
  createdAt: Date;
  items: { name: string; quantity: number }[];
  /** Steps this person may take now. */
  steps: OrderStatus[];
  /** Whether money was received (paid orders are never deleted). */
  paid?: boolean;
  /** New orders: when the restaurant must have answered (5 minutes). */
  deadline?: Date | null;
  /** The delivery person on it, and the ones the kitchen can choose from. */
  courier?: string | null;
  couriers?: { id: string; name: string }[];
  /** On its way: who has confirmed the guest got it, and whether this person still has to ("handed over"). */
  confirmations?: { who: "guest" | "courier" | "desk"; done: boolean }[];
  canConfirm?: boolean;
  /** Staff: who processes it at the restaurant (owner, managers), and whether they can be reminded now. */
  kitchenPeople?: { name: string; phone: string | null; role: "OWNER" | "MANAGER" }[];
  canRemind?: boolean;
  /** The house it goes to, with a map link (for the delivery person). */
  location?: { title: string; address: string; mapUrl: string; room?: { name: string; number: string | null } | null } | null;
};

export const ORDER_TONE: Record<OrderStatus, string> = {
  PLACED: "bg-amber-100 text-amber-900",
  ACCEPTED: "bg-amber-50 text-amber-800",
  PAID: "bg-primary/10 text-primary",
  PREPARING: "bg-primary/10 text-primary",
  READY: "bg-primary/10 text-primary",
  COURIER_ASSIGNED: "bg-emerald-50 text-emerald-800",
  OUT_FOR_DELIVERY: "bg-emerald-100 text-emerald-800",
  DELIVERED: "bg-canvas text-muted",
  FINISHED: "bg-canvas text-muted",
  REJECTED: "bg-red-50 text-red-700",
  TIMED_OUT: "bg-red-50 text-red-700",
  CANCELLED: "bg-red-50 text-red-700",
};

function Line({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-start gap-2">
      <span className="mt-0.5 shrink-0 text-primary [&>svg]:size-4">{icon}</span>
      <span className="min-w-0">{children}</span>
    </span>
  );
}

/**
 * Orders as cards: number, status and total on top; who, where and from which kitchen; the dishes; the next
 * steps. `compact` shows finished orders as one-line rows.
 */
export function OrdersBoard({ orders, compact = false, staffDelete = false }: { orders: BoardOrder[]; compact?: boolean; /** Staff may delete cancelled, unpaid orders. */ staffDelete?: boolean }) {
  const t = useTranslations("Food");
  const tRooms = useTranslations("Rooms");
  const locale = useLocale();
  const router = useRouter();
  // A step that needs a reason the guest reads: reject, cancel, or a failed delivery.
  const [cancelling, setCancelling] = useState<{ ref: string; to: OrderStatus } | null>(null);
  const [courierFor, setCourierFor] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short", timeZone: "Africa/Kigali" });
  const move = (reference: string, to: OrderStatus, note = "") =>
    start(async () => {
      await moveOrderAction(reference, to, note);
      setCancelling(null);
      setReason("");
      router.refresh();
    });

  if (orders.length === 0) return <p className="py-6 text-center text-[14px] text-muted">{t("noOrders")}</p>;

  if (compact)
    return (
      <ul className="flex flex-col divide-y divide-line">
        {orders.map((o) => (
          <li key={o.reference} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2.5 text-[13px]">
            <span className="font-mono font-semibold text-ink">{o.reference}</span>
            <span className="min-w-0 flex-1 truncate text-muted">
              {o.customer}
              {o.address && ` · ${o.address}`}
            </span>
            <span className="text-muted">{time.format(o.createdAt)}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", ORDER_TONE[o.status])}>{t(`status.${o.status}`)}</span>
            <span className="w-20 text-right font-semibold text-ink tabular-nums">{formatRWF(o.total, locale)}</span>
            {staffDelete && o.status === "CANCELLED" && o.paid === false && (
              <ConfirmAction label={t("staffOrders.delete")} question={t("staffOrders.deleteQuestion")} action={deleteFoodOrderAction.bind(null, o.reference)} />
            )}
          </li>
        ))}
      </ul>
    );

  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {orders.map((o) => (
        <li key={o.reference} className="flex flex-col gap-2 rounded-2xl bg-surface p-3 ring-1 ring-line">
          {/* Reference, status, time and total on one line. */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="font-mono text-[15px] font-bold text-ink">{o.reference}</span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-bold", ORDER_TONE[o.status])}>{t(`status.${o.status}`)}</span>
            <span className="text-[12px] text-muted">{time.format(o.createdAt)}</span>
            <span className="ml-auto text-[16px] font-bold text-ink tabular-nums">{formatRWF(o.total, locale)}</span>
          </div>
          {/* Who, from which kitchen, and what: one line. */}
          <p className="truncate text-[13px] leading-5 text-ink">
            <b className="font-semibold">{o.customer}</b>{" "}
            <a href={`tel:${o.phone}`} className="text-primary hover:underline">
              {o.phone}
            </a>
            {o.kitchen && <span className="text-muted"> · {o.kitchen}</span>}
            <span className="text-muted"> · </span>
            {o.items.map((i, n) => (
              <span key={n}>
                {n > 0 && ", "}
                <b className="font-semibold tabular-nums">{i.quantity}×</b> {i.name}
              </span>
            ))}
          </p>
          {o.note && <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[13px] text-amber-900">{t("customerNote", { note: o.note })}</p>}
          {/* Where it goes: the exact room (bold) and the place, with directions; one strip. */}
          {o.location ? (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5 ring-1 ring-amber-200" title={o.location.address}>
              {o.location.room ? <DoorOpen className="size-4 shrink-0 text-amber-700" aria-hidden="true" /> : <MapPin className="size-4 shrink-0 text-amber-700" aria-hidden="true" />}
              <span className="min-w-0 flex-1 truncate text-[13px] text-amber-900">
                {o.location.room && (
                  <b className="font-bold text-amber-950">
                    {o.location.room.number ? `${roomLabel(o.location.room.number, (n) => tRooms("roomNumber", { number: n }))} · ${o.location.room.name}` : o.location.room.name}
                    {" · "}
                  </b>
                )}
                {o.location.title}
              </span>
              <a href={o.location.mapUrl} target="_blank" rel="noopener noreferrer" aria-label={t("board.directions")} title={t("board.directions")} className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-white hover:bg-primary-hover">
                <Navigation className="size-3.5" aria-hidden="true" />
              </a>
            </div>
          ) : (
            o.address && (
              <p className="text-[13px] text-muted">
                <BedDouble className="mr-1 inline size-3.5 text-primary" aria-hidden="true" />
                {o.address}
              </p>
            )
          )}
          {/* Staff: who handles it at the restaurant (call them), and Remind. */}
          {o.kitchenPeople && o.kitchenPeople.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-canvas px-2.5 py-1.5 text-[12px]">
              <span className="min-w-0 flex-1 truncate">
                {o.kitchenPeople.map((p, i) => (
                  <span key={i}>
                    {i > 0 && " · "}
                    <b className="font-semibold text-ink">{p.name}</b> <span className="text-muted">({t(`board.kitchenRole.${p.role}`)})</span>
                    {p.phone && (
                      <a href={`tel:${p.phone}`} className="ml-1 text-primary hover:underline">
                        {p.phone}
                      </a>
                    )}
                  </span>
                ))}
              </span>
              {o.canRemind && <RemindButton reference={o.reference} />}
            </div>
          )}
          {o.status === "PLACED" && o.deadline && <Countdown until={o.deadline} />}
          {o.courier && (
            <Line icon={<Bike />}>
              <span className="text-muted">{t("board.courier", { name: o.courier })}</span>
            </Line>
          )}
          {/* On its way: it is delivered once the guest (and the delivery person, the receptionist) confirm. */}
          {o.status === "OUT_FOR_DELIVERY" && o.confirmations && (
            <div className="flex flex-col gap-2 rounded-xl bg-canvas p-3">
              <span className="text-[12px] font-semibold text-muted">{t("confirm.title")}</span>
              <ul className="flex flex-wrap gap-1.5">
                {o.confirmations.map((c) => (
                  <li key={c.who} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold", c.done ? "bg-emerald-50 text-emerald-800" : "bg-surface text-muted ring-1 ring-line")}>
                    {c.done ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <Circle className="size-3.5" aria-hidden="true" />}
                    {t(`confirm.who.${c.who}`)}
                  </li>
                ))}
              </ul>
              {o.canConfirm && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await confirmDeliveryAction(o.reference);
                      router.refresh();
                    })
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  {t("confirm.handedOver")}
                </button>
              )}
            </div>
          )}
          {o.steps.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {o.steps
                .filter((s) => !["CANCELLED", "REJECTED", "COURIER_ASSIGNED"].includes(s) && !(s === "READY" && o.status === "OUT_FOR_DELIVERY"))
                .map((step) => (
                  <button key={step} type="button" disabled={pending} onClick={() => move(o.reference, step)} className="flex-1 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
                    {o.status === "READY" && step === "OUT_FOR_DELIVERY" ? t("board.deliverOurselves") : t(`board.step.${step as "ACCEPTED"}`)}
                  </button>
                ))}
              {/* Ready: hand it to one of the restaurant's delivery people. */}
              {o.steps.includes("COURIER_ASSIGNED") && (
                <span className="flex w-full gap-2">
                  <Select
                    aria-label={t("board.chooseCourier")}
                    value={courierFor[o.reference] ?? ""}
                    onChange={(e) => setCourierFor({ ...courierFor, [o.reference]: e.target.value })}
                    className="min-w-0 flex-1 rounded-full border border-line-strong bg-surface px-3 py-2 text-[14px]"
                  >
                    <option value="">{(o.couriers ?? []).length ? t("board.chooseCourier") : t("board.noCouriers")}</option>
                    {(o.couriers ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    disabled={pending || !courierFor[o.reference]}
                    onClick={() =>
                      start(async () => {
                        await assignCourierAction(o.reference, courierFor[o.reference]!);
                        router.refresh();
                      })
                    }
                    className="rounded-full bg-primary px-4 py-2 text-[14px] font-semibold text-white disabled:opacity-50"
                  >
                    {t("board.assign")}
                  </button>
                </span>
              )}
              {(["REJECTED", "CANCELLED"] as const)
                .filter((s) => o.steps.includes(s))
                .map((s) => (
                  <button key={s} type="button" disabled={pending} onClick={() => setCancelling(cancelling?.ref === o.reference ? null : { ref: o.reference, to: s })} className="rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-danger disabled:opacity-50">
                    {t(`board.step.${s}`)}
                  </button>
                ))}
              {o.status === "OUT_FOR_DELIVERY" && o.steps.includes("READY") && (
                <button type="button" disabled={pending} onClick={() => setCancelling(cancelling?.ref === o.reference ? null : { ref: o.reference, to: "READY" })} className="rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-danger disabled:opacity-50">
                  {t("board.failed")}
                </button>
              )}
            </div>
          )}
          {cancelling?.ref === o.reference && (
            <div className="flex gap-2">
              <input
                value={reason}
                maxLength={300}
                placeholder={cancelling.to === "READY" ? t("board.failedReason") : t("declineReason")}
                onChange={(e) => setReason(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-primary"
              />
              <button type="button" disabled={pending || !reason.trim()} onClick={() => move(o.reference, cancelling.to, reason)} className="rounded-full bg-danger px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
                {t("declineConfirm")}
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Time left to answer a new order (5 minutes), ticking every second. */
function Countdown({ until }: { until: Date }) {
  const t = useTranslations("Food.board");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.round((new Date(until).getTime() - now) / 1000));
  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  return (
    <p className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold tabular-nums", left > 60 ? "bg-amber-50 text-amber-900" : "bg-red-50 text-red-800")}>
      <Timer className="size-4" aria-hidden="true" />
      {left > 0 ? t("answerWithin", { time: mmss }) : t("timedOut")}
    </p>
  );
}

/** Staff: notify the restaurant's owner and managers about this order (once a minute at most). */
function RemindButton({ reference }: { reference: string }) {
  const t = useTranslations("Food.board");
  const [state, setState] = useState<"idle" | "sent" | "tooSoon" | "failed">("idle");
  const [pending, start] = useTransition();
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await remindRestaurantAction(reference);
            setState(r.ok ? "sent" : r.error === "tooSoon" ? "tooSoon" : "failed");
          })
        }
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-amber-500 px-2.5 text-[12px] font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
      >
        <Bell className="size-4" aria-hidden="true" />
        {t("remind")}
      </button>
      {state !== "idle" && <span className={state === "sent" ? "text-[12px] font-medium text-emerald-700" : "text-[12px] font-medium text-danger"}>{t(`remindState.${state}`)}</span>}
    </span>
  );
}
