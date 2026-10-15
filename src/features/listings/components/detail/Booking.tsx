"use client";

import { Tag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { LONG_UNITS, type BookingUnit } from "@/features/bookings/period";
import { discountedPrice, type Unit } from "@/features/listings/pricing";
import { nightsBetween } from "@/features/listings/quote";
import { DatePanel } from "@/features/search/components/DatePanel";
import { isDayBlocked, todayISO, type BookedRange, type DateRange } from "@/features/search/date-range";
import { Link, usePathname } from "@/i18n/navigation";
import { animateScrollTo } from "@/lib/animate-scroll";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import type { PlacePreviewData } from "./PlacePreview";
import { ReserveDialog, type ReservePlan } from "./Reserve";

export type BookingRate = {
  unit: Unit;
  price: number;
  minUnits?: number;
  maxUnits?: number | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  dayStartTime: string | null;
  dayEndTime: string | null;
};

export type PublicRoom = { id: string; name: string; description: string; maxGuests: number; facilities: string[]; rates: { unit: Unit; price: number }[] };
export type BookingModel = "WHOLE_PROPERTY" | "ROOM_BY_ROOM" | "BOTH";
/** "whole" = the whole place; a room id; null = a room still has to be chosen. */
export type StayChoice = "whole" | string | null;
/** Long stays (month/year): upfront months, deposit and identity rules set by staff. Null for lodges. */
export type LongStayConfig = { upfrontMonths: number | null; depositPercent: number | null; identity?: "NONE" | "ID" | "ID_NATIONALITY" } | null;
type Plan = { start: string; quantity: number; startTime: string };

type Stay = {
  /** Nightly stays: check-in and checkout from the calendar. */
  range: DateRange;
  setRange: (range: DateRange) => void;
  guests: number;
  setGuests: (n: number) => void;
  /** Days taken, for the whole place and for each room (roomId null = whole-place bookings). */
  booked: (BookedRange & { roomId: string | null })[];
  listingId: string;
  /** Minutes an unpaid booking holds the place. */
  holdMinutes: number;
  rooms: PublicRoom[];
  bookingModel: BookingModel;
  choice: StayChoice;
  setChoice: (choice: StayChoice) => void;
  /** Platform fee on top of the price, in basis points (null = none). */
  guestFeeBps: number | null;
  /** Published cancellation terms in the reader's language. */
  cancellationPolicy: string | null;
  longStay: LongStayConfig;
  /** How the client books: by the hour, day, night, week, month or year. */
  unit: BookingUnit;
  setUnit: (unit: BookingUnit) => void;
  /** Every unit except nights: first day (and start time for hours) and how many. */
  plan: Plan;
  setPlan: (plan: Plan) => void;
};

const StayContext = createContext<Stay | null>(null);
const CALENDAR_ID = "stay-calendar";
const ROOMS_ID = "rooms";
const PLAN_ID = "booking-plan";

function useStay(): Stay {
  const stay = useContext(StayContext);
  if (!stay) throw new Error("useStay must be used inside <StayProvider>");
  return stay;
}

/** Booking choices shared by the page sections (rooms, calendar) and the booking card. */
export function StayProvider({
  children,
  listingId = "",
  booked = [],
  holdMinutes = 30,
  rooms = [],
  bookingModel = "WHOLE_PROPERTY",
  guestFeeBps = null,
  cancellationPolicy = null,
  longStay = null,
  defaultUnit = "NIGHT",
}: {
  children: ReactNode;
  listingId?: string;
  booked?: (BookedRange & { roomId?: string | null })[];
  holdMinutes?: number;
  rooms?: PublicRoom[];
  bookingModel?: BookingModel;
  guestFeeBps?: number | null;
  cancellationPolicy?: string | null;
  longStay?: LongStayConfig;
  defaultUnit?: BookingUnit;
}) {
  const [range, setRange] = useState<DateRange>({});
  const [guests, setGuests] = useState(1);
  const [choice, setChoice] = useState<StayChoice>(bookingModel === "ROOM_BY_ROOM" ? null : "whole");
  const [unit, setUnit] = useState<BookingUnit>(defaultUnit);
  const [plan, setPlan] = useState<Plan>({ start: "", quantity: 1, startTime: "" });
  const normalized = booked.map((b) => ({ ...b, roomId: b.roomId ?? null }));
  return (
    <StayContext.Provider
      value={{
        range,
        setRange,
        guests,
        setGuests,
        booked: normalized,
        listingId,
        holdMinutes,
        rooms,
        bookingModel,
        choice,
        setChoice,
        guestFeeBps,
        cancellationPolicy,
        longStay,
        unit,
        setUnit,
        plan,
        setPlan,
      }}
    >
      {children}
    </StayContext.Provider>
  );
}

/** What the current choice can't overlap: everything for the whole place; that room and whole-place bookings for a room. */
function takenFor(booked: Stay["booked"], choice: StayChoice): BookedRange[] {
  if (choice === "whole") return booked;
  return booked.filter((b) => b.roomId === null || b.roomId === choice);
}

const UNIT_ORDER: BookingUnit[] = ["HOUR", "DAY", "NIGHT", "WEEK", "MONTH", "YEAR"];
const byUnitOrder = (a: { unit: string }, b: { unit: string }) => UNIT_ORDER.indexOf(a.unit as BookingUnit) - UNIT_ORDER.indexOf(b.unit as BookingUnit);

/**
 * The ways the current choice can be booked: the place's rates, or the room's own prices (with the place's rules
 * for length and opening hours). Lodges only ever offer nights and days (enforced by the host form and the server).
 */
function useOffer(rates: BookingRate[]) {
  const { choice, rooms, unit } = useStay();
  const room = rooms.find((r) => r.id === choice) ?? null;
  const offered: BookingRate[] = room
    ? room.rates.map((r) => {
        const rule = rates.find((x) => x.unit === r.unit);
        return {
          unit: r.unit,
          price: r.price,
          minUnits: rule?.minUnits,
          maxUnits: rule?.maxUnits,
          checkInTime: rule?.checkInTime ?? null,
          checkOutTime: rule?.checkOutTime ?? null,
          dayStartTime: rule?.dayStartTime ?? null,
          dayEndTime: rule?.dayEndTime ?? null,
        };
      })
    : rates;
  const sorted = [...offered].sort(byUnitOrder);
  const current = sorted.find((r) => r.unit === unit) ?? sorted[0] ?? null;
  return { room, offered: sorted, current };
}

const feeOf = (amount: number, bps: number | null) => (bps ? Math.round((amount * bps) / 10_000) : 0);
const DEFAULT_MAX: Record<BookingUnit, number> = { HOUR: 12, DAY: 30, NIGHT: 365, WEEK: 12, MONTH: 24, YEAR: 5 };
const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** The lengths this rate allows (hours also stop at closing time), and the plan's length kept inside them. */
function lengthLimits(rate: BookingRate, plan: Plan) {
  const unit = rate.unit as BookingUnit;
  const min = Math.max(1, rate.minUnits ?? 1);
  const max = Math.max(min, rate.maxUnits ?? DEFAULT_MAX[unit]);
  const close = rate.dayEndTime ? toMinutes(rate.dayEndTime) : 24 * 60;
  const hoursLeft = plan.startTime ? Math.floor((close - toMinutes(plan.startTime)) / 60) : max;
  const top = unit === "HOUR" ? Math.max(min, Math.min(max, hoursLeft)) : max;
  return { min, top, quantity: Math.min(Math.max(plan.quantity, min), top) };
}

/** Everything the price and the Reserve window need, once the client has said when and for how long. */
function useQuote(rates: BookingRate[], discountPercent: number | null) {
  const { range, plan, longStay } = useStay();
  const { current, room } = useOffer(rates);
  if (!current) return { current, room, ready: false as const };
  const unit = current.unit as BookingUnit;
  const unitPrice = discountedPrice(current.price, discountPercent);
  const quantity = unit === "NIGHT" ? nightsBetween(range) : lengthLimits(current, plan).quantity;
  const start = unit === "NIGHT" ? range.checkIn : plan.start;
  const ready = Boolean(start && quantity > 0 && (unit !== "HOUR" || plan.startTime));
  if (!ready || !start) return { current, room, ready: false as const };
  const long = LONG_UNITS.includes(unit);
  // Monthly: every chosen month now unless staff set fewer upfront.
  const paidQuantity = unit === "MONTH" ? Math.min(longStay?.upfrontMonths ?? quantity, quantity) : quantity;
  // Deposit for long stays: a percent of one month's rent (a year's rent / 12).
  const monthRent = unit === "MONTH" ? unitPrice : unit === "YEAR" ? Math.round(unitPrice / 12) : 0;
  const deposit = long && longStay?.depositPercent ? Math.round((monthRent * longStay.depositPercent) / 100) : 0;
  const plan_: ReservePlan = {
    unit,
    start,
    startTime: unit === "HOUR" ? plan.startTime : null,
    quantity,
    paidQuantity,
    unitPrice,
    subtotal: unitPrice * paidQuantity,
    originalSubtotal: unitPrice === current.price ? null : current.price * paidQuantity,
    deposit,
    identity: long ? (longStay?.identity ?? "NONE") : "NONE",
    checkInTime: unit === "NIGHT" ? current.checkInTime : null,
    checkOutTime: unit === "NIGHT" ? current.checkOutTime : null,
  };
  return { current, room, ready: true as const, plan: plan_ };
}

/** "Choose a room" (places that rent by the room): the whole place (if offered) and each available room. */
export function RoomPicker({ wholeRates }: { wholeRates: { unit: Unit; price: number }[] }) {
  const t = useTranslations("Rooms");
  const tListings = useTranslations("Listings");
  const tFacility = useTranslations("Facility");
  const locale = useLocale();
  const { rooms, bookingModel, choice, setChoice, setRange, guests, setGuests, unit, setUnit } = useStay();
  if (bookingModel === "WHOLE_PROPERTY" || rooms.length === 0) return null;
  const options: PublicRoom[] = [
    ...(bookingModel === "BOTH" && wholeRates.length > 0 ? [{ id: "whole", name: t("wholePlace"), description: "", maxGuests: 0, facilities: [], rates: wholeRates }] : []),
    ...rooms,
  ];
  return (
    <section id={ROOMS_ID} className="scroll-mt-28 border-t border-line py-10">
      <h2 className="mb-6 font-display text-[22px] leading-7 font-bold tracking-[-0.02em] text-ink">{t("choose")}</h2>
      <div role="radiogroup" aria-label={t("choose")} className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const selected = choice === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                setChoice(option.id);
                // Dates chosen for another room may not suit this one; keep the way of booking if this one offers it.
                setRange({});
                if (!option.rates.some((r) => r.unit === unit) && option.rates[0]) setUnit([...option.rates].sort(byUnitOrder)[0]!.unit as BookingUnit);
                if (option.maxGuests && guests > option.maxGuests) setGuests(option.maxGuests);
              }}
              className={cn(
                "flex flex-col gap-1 rounded-2xl border bg-surface p-4 text-left transition-[border-color,box-shadow] duration-300",
                selected ? "border-primary shadow-[0_8px_24px_-12px_rgba(0,87,184,0.6)] ring-1 ring-primary" : "border-line hover:border-primary/60",
              )}
            >
              <span className="text-[15px] font-semibold text-ink">{option.name}</span>
              <span className="text-[13px] text-ink/80">
                {[...option.rates]
                  .sort(byUnitOrder)
                  .map((r) => `${formatRWF(r.price, locale)} ${tListings(`perUnit.${r.unit}`)}`)
                  .join(" · ")}
                {option.maxGuests > 0 && ` · ${t("guests", { count: option.maxGuests })}`}
              </span>
              {option.description && <span className="text-[13px] text-muted">{option.description}</span>}
              {option.facilities.length > 0 && (
                <span className="text-xs text-muted">{option.facilities.map((f) => tFacility(f as "WIFI")).join(" · ")}</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** "2 nights in Kigali" calendar section (left column), shown while booking by the night. */
export function StayCalendar({ city, rates, today = todayISO() }: { city: string; rates?: BookingRate[]; today?: string }) {
  const t = useTranslations("Listings");
  const locale = useLocale();
  const { range, setRange, booked: allBooked, choice } = useStay();
  const { current } = useOffer(rates ?? []);
  if (rates && current?.unit !== "NIGHT") return null;
  const booked = takenFor(allBooked, choice);
  const nights = nightsBetween(range);
  const short = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

  return (
    <section id={CALENDAR_ID} className="scroll-mt-28 border-t border-line py-10">
      <h2 className="font-display text-[22px] leading-7 font-bold tracking-[-0.02em] text-ink">
        {nights > 0 ? t("nightsIn", { count: nights, city }) : range.checkIn ? t("selectCheckOut") : t("selectCheckIn")}
      </h2>
      <p className="mt-1 mb-6 text-sm text-muted">
        {range.checkIn && range.checkOut ? `${short.format(utc(range.checkIn))} – ${short.format(utc(range.checkOut))}` : t("datesHint")}
      </p>
      <DatePanel
        today={today}
        range={range}
        flex={0}
        onRangeChange={setRange}
        onFlexChange={() => {}}
        showFlex={false}
        isBlocked={booked.length > 0 ? (day) => isDayBlocked(range, day, booked) : undefined}
      />
    </section>
  );
}

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) void animateScrollTo(el.getBoundingClientRect().top + window.scrollY - 112);
}

/**
 * Reserve: asks for a room first (room-by-room places), then for the dates or the start, and opens "Confirm and pay".
 * Signed-out visitors log in first.
 */
function ReserveButton({
  rates,
  discountPercent,
  place,
  signedIn,
  className,
}: {
  rates: BookingRate[];
  discountPercent: number | null;
  place: PlacePreviewData;
  signedIn: boolean;
  className: string;
}) {
  const t = useTranslations("Listings");
  const pathname = usePathname();
  const { guests, listingId, holdMinutes, choice, guestFeeBps, cancellationPolicy } = useStay();
  const quote = useQuote(rates, discountPercent);
  const [open, setOpen] = useState(false);

  if (!quote.current) {
    return (
      <button type="button" disabled className={className}>
        {t("reserve")}
      </button>
    );
  }
  if (!signedIn) {
    return (
      <Link href={{ pathname: "/login", query: { next: pathname } }} className={cn(className, "block text-center")}>
        {t("reserve")}
      </Link>
    );
  }
  const unit = quote.current.unit;
  return (
    <>
      <button
        type="button"
        onClick={() => (choice === null ? scrollTo(ROOMS_ID) : quote.ready ? setOpen(true) : scrollTo(unit === "NIGHT" ? CALENDAR_ID : PLAN_ID))}
        className={className}
      >
        {choice === null ? t("chooseRoom") : t("reserve")}
      </button>
      {open && quote.ready && (
        <ReserveDialog
          listingId={listingId}
          holdMinutes={holdMinutes}
          room={quote.room ? { id: quote.room.id, name: quote.room.name } : null}
          guestFeeBps={guestFeeBps}
          cancellationPolicy={cancellationPolicy}
          place={place}
          plan={quote.plan}
          guests={guests}
          savings={quote.plan.originalSubtotal ? quote.plan.originalSubtotal - quote.plan.subtotal : null}
          onClose={() => setOpen(false)}
          onChangeDates={() => {
            setOpen(false);
            scrollTo(unit === "NIGHT" ? CALENDAR_ID : PLAN_ID);
          }}
        />
      )}
    </>
  );
}

/** Sticky booking card (right column): how to book, when, guests, price, Reserve. */
export function BookingCard({
  rates,
  discountPercent,
  maxGuests,
  place,
  signedIn,
}: {
  rates: BookingRate[];
  discountPercent: number | null;
  maxGuests: number;
  place: PlacePreviewData;
  signedIn: boolean;
}) {
  const t = useTranslations("Listings");
  const locale = useLocale();
  const guestsId = useId();
  const { range, guests, setGuests, guestFeeBps, setUnit } = useStay();
  const { offered, current, room } = useOffer(rates);
  const quote = useQuote(rates, discountPercent);
  const unit = (current?.unit ?? "NIGHT") as BookingUnit;
  const long = LONG_UNITS.includes(unit);
  const guestLimit = room?.maxGuests ?? maxGuests;
  const discounted = Boolean(discountPercent && discountPercent > 0);
  const short = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const date = (iso?: string) => (iso ? short.format(new Date(`${iso}T00:00:00Z`)) : t("addDate"));
  const bold = (chunks: ReactNode) => <span className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink">{chunks}</span>;
  const guestFee = quote.ready ? feeOf(quote.plan.subtotal, guestFeeBps) : 0;

  return (
    <aside className="flex flex-col gap-4">
      {discounted && (
        <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-line/70 bg-surface px-5 py-3.5 text-sm font-semibold text-ink shadow-[0_6px_20px_-10px_rgba(16,24,40,0.25)]">
          <Tag className="size-5 fill-emerald-500 text-emerald-600" aria-hidden="true" />
          {t("discountOffer")}
        </div>
      )}
      <div className="rounded-2xl border border-line/70 bg-surface p-6 shadow-[0_12px_32px_-14px_rgba(16,24,40,0.3)]">
        {/* Price */}
        <p className="flex flex-wrap items-baseline gap-x-2 text-[15px] text-muted">
          {quote.ready && unit === "NIGHT" ? (
            <>
              {quote.plan.originalSubtotal && <s className="text-muted">{formatRWF(quote.plan.originalSubtotal, locale)}</s>}
              {t.rich("perStay", { price: formatRWF(quote.plan.subtotal, locale), count: quote.plan.quantity, b: bold })}
            </>
          ) : (
            current && (
              <>
                {discounted && <s>{formatRWF(current.price, locale)}</s>}
                {bold(formatRWF(discountedPrice(current.price, discountPercent), locale))}
                <span>{t(`perUnit.${current.unit}`)}</span>
              </>
            )
          )}
        </p>

        {room && (
          <p className="mt-3 text-sm text-ink">
            <span className="text-muted">{t("roomLabel")}</span> <b className="font-semibold">{room.name}</b>
          </p>
        )}

        {/* How to book: the ways this place (or room) is offered */}
        {offered.length > 1 && (
          <div role="radiogroup" aria-label={t("howToRent")} className="mt-4 flex flex-wrap gap-2">
            {offered.map((rate) => {
              const on = rate.unit === unit;
              return (
                <button
                  key={rate.unit}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setUnit(rate.unit as BookingUnit)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors duration-300",
                    on ? "border-primary bg-primary font-semibold text-white" : "border-line text-ink hover:border-primary/60",
                  )}
                >
                  {t(`by.${rate.unit}`)}
                </button>
              );
            })}
          </div>
        )}

        {/* When */}
        <div id={PLAN_ID} className="mt-5 scroll-mt-28 overflow-hidden rounded-xl border border-line-strong">
          {unit === "NIGHT" ? (
            <div className="grid grid-cols-2 divide-x divide-line-strong">
              {(
                [
                  ["checkInLabel", range.checkIn],
                  ["checkOutLabel", range.checkOut],
                ] as const
              ).map(([label, value]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => scrollTo(CALENDAR_ID)}
                  className="flex flex-col items-start gap-0.5 px-3.5 py-2.5 text-left transition-colors hover:bg-canvas"
                >
                  <span className="text-xs font-semibold text-ink">{t(label)}</span>
                  <span className={cn("text-sm", value ? "text-ink" : "text-muted")}>{date(value)}</span>
                </button>
              ))}
            </div>
          ) : (
            current && <PlanFields rate={current} />
          )}
          {!long && (
            <label htmlFor={guestsId} className="flex flex-col gap-0.5 border-t border-line-strong px-3.5 py-2.5 transition-colors hover:bg-canvas">
              <span className="text-xs font-semibold text-ink">{t("guestsLabel")}</span>
              <select
                id={guestsId}
                value={guests}
                onChange={(event) => setGuests(Number(event.target.value))}
                className="-ml-1 cursor-pointer bg-transparent text-sm text-ink outline-none"
              >
                {Array.from({ length: guestLimit }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {t("statGuests", { count: n })}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <ReserveButton
          rates={rates}
          discountPercent={discountPercent}
          place={place}
          signedIn={signedIn}
          className="mt-4 w-full rounded-full bg-gradient-to-r from-primary to-[#0a6fe0] py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,87,184,0.8)] transition-[filter,transform] duration-300 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        />
        <p className="mt-3 text-center text-[13px] text-muted">{t("wontBeCharged")}</p>

        {/* Breakdown */}
        {quote.ready && (
          <dl className="mt-5 flex flex-col gap-3 border-t border-line pt-5 text-[15px] tabular-nums">
            <div className="flex justify-between text-ink/80">
              <dt className="underline decoration-line-strong underline-offset-4">
                {t(`unitTimes.${unit}`, { price: formatRWF(quote.plan.unitPrice, locale), count: quote.plan.paidQuantity })}
              </dt>
              <dd>{formatRWF(quote.plan.subtotal, locale)}</dd>
            </div>
            {quote.plan.deposit > 0 && (
              <div className="flex justify-between text-ink/80">
                <dt>{t("depositDue")}</dt>
                <dd>{formatRWF(quote.plan.deposit, locale)}</dd>
              </div>
            )}
            {guestFee > 0 && (
              <div className="flex justify-between text-ink/80">
                <dt>{t("serviceFee")}</dt>
                <dd>{formatRWF(guestFee, locale)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-3 font-bold text-ink">
              <dt>{long ? t("dueNow") : t("total")}</dt>
              <dd>{formatRWF(quote.plan.subtotal + quote.plan.deposit + guestFee, locale)}</dd>
            </div>
          </dl>
        )}

        {/* Opening hours, when booking by the hour or day */}
        {(unit === "HOUR" || unit === "DAY") && current?.dayStartTime && current.dayEndTime && (
          <p className="mt-4 text-center text-[13px] text-muted">{t("openHours", { start: current.dayStartTime, end: current.dayEndTime })}</p>
        )}
      </div>
    </aside>
  );
}

/** Start (and start time for hours) and how many, for every way of booking except nights. */
function PlanFields({ rate }: { rate: BookingRate }) {
  const t = useTranslations("Listings");
  const { plan, setPlan } = useStay();
  const startId = useId();
  const timeId = useId();
  const countId = useId();
  const unit = rate.unit as BookingUnit;
  const { min, top, quantity } = lengthLimits(rate, plan);
  // Half-hour start times inside opening hours, leaving room for at least the minimum length.
  const open = rate.dayStartTime ? toMinutes(rate.dayStartTime) : 0;
  const close = rate.dayEndTime ? toMinutes(rate.dayEndTime) : 24 * 60;
  const times: string[] = [];
  for (let m = open; m + min * 60 <= close; m += 30) times.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);

  return (
    <>
      <label htmlFor={startId} className="flex flex-col gap-0.5 px-3.5 py-2.5 transition-colors hover:bg-canvas">
        <span className="text-xs font-semibold text-ink">{LONG_UNITS.includes(unit) ? t("moveIn") : t("startDate")}</span>
        <input
          id={startId}
          type="date"
          min={todayISO()}
          value={plan.start}
          onChange={(e) => setPlan({ ...plan, start: e.target.value })}
          className="bg-transparent text-sm text-ink outline-none"
        />
      </label>
      {unit === "HOUR" && (
        <label htmlFor={timeId} className="flex flex-col gap-0.5 border-t border-line-strong px-3.5 py-2.5 transition-colors hover:bg-canvas">
          <span className="text-xs font-semibold text-ink">{t("startTime")}</span>
          <select
            id={timeId}
            value={plan.startTime}
            onChange={(e) => setPlan({ ...plan, startTime: e.target.value })}
            className="-ml-1 cursor-pointer bg-transparent text-sm text-ink outline-none"
          >
            <option value="">{t("chooseTime")}</option>
            {times.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
        </label>
      )}
      <label htmlFor={countId} className="flex flex-col gap-0.5 border-t border-line-strong px-3.5 py-2.5 transition-colors hover:bg-canvas">
        <span className="text-xs font-semibold text-ink">{t("rentalLength")}</span>
        <select
          id={countId}
          value={quantity}
          onChange={(e) => setPlan({ ...plan, quantity: Number(e.target.value) })}
          className="-ml-1 cursor-pointer bg-transparent text-sm text-ink outline-none"
        >
          {Array.from({ length: Math.max(1, top - min + 1) }, (_, i) => min + i).map((n) => (
            <option key={n} value={n}>
              {t(`unitCount.${unit}`, { count: n })}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

/** Phones: price and Reserve pinned above the tab bar. */
export function MobileBookingBar({
  rates,
  discountPercent,
  place,
  signedIn,
}: {
  rates: BookingRate[];
  discountPercent: number | null;
  place: PlacePreviewData;
  signedIn: boolean;
}) {
  const t = useTranslations("Listings");
  const locale = useLocale();
  const { current } = useOffer(rates);
  const quote = useQuote(rates, discountPercent);
  const bold = (chunks: ReactNode) => <b className="text-ink">{chunks}</b>;
  return (
    <div className="fixed inset-x-0 bottom-[calc(82px+env(safe-area-inset-bottom))] z-30 mx-3 flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-4 py-3 shadow-[0_10px_30px_-12px_rgba(16,24,40,0.35)] md:hidden">
      <p className="text-sm text-muted">
        {quote.ready && quote.plan.unit === "NIGHT"
          ? t.rich("perStay", { price: formatRWF(quote.plan.subtotal, locale), count: quote.plan.quantity, b: bold })
          : current && (
              <>
                {bold(formatRWF(discountedPrice(current.price, discountPercent), locale))} {t(`perUnit.${current.unit}`)}
              </>
            )}
      </p>
      <ReserveButton
        rates={rates}
        discountPercent={discountPercent}
        place={place}
        signedIn={signedIn}
        className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
      />
    </div>
  );
}
