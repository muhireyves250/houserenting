"use client";

import { Tag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { discountedPrice, headlineRate, type Unit } from "@/features/listings/pricing";
import { stayQuote } from "@/features/listings/quote";
import { DatePanel } from "@/features/search/components/DatePanel";
import { isDayBlocked, todayISO, type BookedRange, type DateRange } from "@/features/search/date-range";
import { Link, usePathname } from "@/i18n/navigation";
import { animateScrollTo } from "@/lib/animate-scroll";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import type { PlacePreviewData } from "./PlacePreview";
import { ReserveDialog } from "./Reserve";

export type BookingRate = {
  unit: Unit;
  price: number;
  checkInTime: string | null;
  checkOutTime: string | null;
  dayStartTime: string | null;
  dayEndTime: string | null;
};

export type PublicRoom = { id: string; name: string; description: string; maxGuests: number; nightlyPrice: number; facilities: string[] };
export type BookingModel = "WHOLE_PROPERTY" | "ROOM_BY_ROOM" | "BOTH";
/** "whole" = the whole place; a room id; null = a room still has to be chosen. */
export type StayChoice = "whole" | string | null;

type Stay = {
  range: DateRange;
  setRange: (range: DateRange) => void;
  guests: number;
  setGuests: (n: number) => void;
  /** Nights taken, for the whole place and for each room (roomId null = whole-place stays). */
  booked: (BookedRange & { roomId: string | null })[];
  listingId: string;
  /** Minutes an unpaid booking holds its dates. */
  holdMinutes: number;
  rooms: PublicRoom[];
  bookingModel: BookingModel;
  choice: StayChoice;
  setChoice: (choice: StayChoice) => void;
  /** Platform fee on top of the stay price, in basis points (null = none). */
  guestFeeBps: number | null;
  /** Published cancellation terms in the reader's language. */
  cancellationPolicy: string | null;
};

const StayContext = createContext<Stay | null>(null);
const CALENDAR_ID = "stay-calendar";
const ROOMS_ID = "rooms";

function useStay(): Stay {
  const stay = useContext(StayContext);
  if (!stay) throw new Error("useStay must be used inside <StayProvider>");
  return stay;
}

/** Dates and guests shared by the page's calendar section and the booking card. */
export function StayProvider({
  children,
  listingId = "",
  booked = [],
  holdMinutes = 30,
  rooms = [],
  bookingModel = "WHOLE_PROPERTY",
  guestFeeBps = null,
  cancellationPolicy = null,
}: {
  children: ReactNode;
  listingId?: string;
  booked?: (BookedRange & { roomId?: string | null })[];
  holdMinutes?: number;
  rooms?: PublicRoom[];
  bookingModel?: BookingModel;
  guestFeeBps?: number | null;
  cancellationPolicy?: string | null;
}) {
  const [range, setRange] = useState<DateRange>({});
  const [guests, setGuests] = useState(1);
  const [choice, setChoice] = useState<StayChoice>(bookingModel === "ROOM_BY_ROOM" ? null : "whole");
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
      }}
    >
      {children}
    </StayContext.Provider>
  );
}

/** What the current choice can't overlap: everything for the whole place; that room and whole-place stays for a room. */
function takenFor(booked: Stay["booked"], choice: StayChoice): BookedRange[] {
  if (choice === "whole") return booked;
  return booked.filter((b) => b.roomId === null || b.roomId === choice);
}

/** Rates for the current choice: a room has its own nightly price. */
function useChoiceRates(rates: BookingRate[]): { rates: BookingRate[]; room: PublicRoom | null } {
  const { choice, rooms } = useStay();
  const room = rooms.find((r) => r.id === choice) ?? null;
  if (!room) return { rates, room: null };
  const night = rates.find((r) => r.unit === "NIGHT");
  return {
    rates: [{ unit: "NIGHT", price: room.nightlyPrice, checkInTime: night?.checkInTime ?? null, checkOutTime: night?.checkOutTime ?? null, dayStartTime: null, dayEndTime: null }],
    room,
  };
}

const feeOf = (amount: number, bps: number | null) => (bps ? Math.round((amount * bps) / 10_000) : 0);

/** "Choose a room" (places that rent by the room): the whole place (if offered) and each available room. */
export function RoomPicker({ wholePrice }: { wholePrice: number | null }) {
  const t = useTranslations("Rooms");
  const tFacility = useTranslations("Facility");
  const locale = useLocale();
  const { rooms, bookingModel, choice, setChoice, setRange, guests, setGuests } = useStay();
  if (bookingModel === "WHOLE_PROPERTY" || rooms.length === 0) return null;
  const options = [
    ...(bookingModel === "BOTH" && wholePrice ? [{ id: "whole", name: t("wholePlace"), description: "", maxGuests: 0, nightlyPrice: wholePrice, facilities: [] as string[] }] : []),
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
                // Dates chosen for another room may not suit this one.
                setRange({});
                if (option.maxGuests && guests > option.maxGuests) setGuests(option.maxGuests);
              }}
              className={cn(
                "flex flex-col gap-1 rounded-2xl border bg-surface p-4 text-left transition-[border-color,box-shadow] duration-300",
                selected ? "border-primary shadow-[0_8px_24px_-12px_rgba(0,87,184,0.6)] ring-1 ring-primary" : "border-line hover:border-primary/60",
              )}
            >
              <span className="text-[15px] font-semibold text-ink">{option.name}</span>
              <span className="text-[13px] text-ink/80">
                <b className="font-semibold text-ink">{formatRWF(option.nightlyPrice, locale)}</b> {t("perNight")}
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

/** "2 nights in Kigali" calendar section (left column). */
export function StayCalendar({ city, today = todayISO() }: { city: string; today?: string }) {
  const t = useTranslations("Listings");
  const locale = useLocale();
  const { range, setRange, booked: allBooked, choice } = useStay();
  const booked = takenFor(allBooked, choice);
  const quoteNights = stayQuote([{ unit: "NIGHT", price: 1 }], null, range)?.nights ?? 0;
  const short = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

  return (
    <section id={CALENDAR_ID} className="scroll-mt-28 border-t border-line py-10">
      <h2 className="font-display text-[22px] leading-7 font-bold tracking-[-0.02em] text-ink">
        {quoteNights > 0 ? t("nightsIn", { count: quoteNights, city }) : range.checkIn ? t("selectCheckOut") : t("selectCheckIn")}
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

function scrollToRooms() {
  const el = document.getElementById(ROOMS_ID);
  if (el) void animateScrollTo(el.getBoundingClientRect().top + window.scrollY - 112);
}

function scrollToCalendar() {
  const el = document.getElementById(CALENDAR_ID);
  if (el) void animateScrollTo(el.getBoundingClientRect().top + window.scrollY - 112);
}

/**
 * Reserve: opens "Confirm and pay" once dates are chosen, otherwise takes you to the calendar.
 * Signed-out visitors log in first. Long-term only places keep "Apply for viewing" (not live yet).
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
  const { range, guests, listingId, holdMinutes, choice, guestFeeBps, cancellationPolicy } = useStay();
  const { rates: choiceRates, room } = useChoiceRates(rates);
  const [open, setOpen] = useState(false);
  const quote = stayQuote(choiceRates, discountPercent, range);
  const night = rates.find((r) => r.unit === "NIGHT");
  const longOnly = !rates.some((r) => r.unit !== "MONTH");

  if (longOnly || !night) {
    return (
      <button type="button" disabled className={className}>
        {longOnly ? t("applyViewing") : t("reserve")}
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
  return (
    <>
      <button type="button" onClick={() => (choice === null ? scrollToRooms() : quote ? setOpen(true) : scrollToCalendar())} className={className}>
        {choice === null ? t("chooseRoom") : t("reserve")}
      </button>
      {open && quote && (
        <ReserveDialog
          listingId={listingId}
          holdMinutes={holdMinutes}
          room={room ? { id: room.id, name: room.name } : null}
          guestFee={feeOf(quote.total, guestFeeBps)}
          cancellationPolicy={cancellationPolicy}
          place={place}
          quote={quote}
          range={range}
          guests={guests}
          checkInTime={night.checkInTime}
          checkOutTime={night.checkOutTime}
          savings={quote.originalTotal ? quote.originalTotal - quote.total : null}
          onClose={() => setOpen(false)}
          onChangeDates={() => {
            setOpen(false);
            scrollToCalendar();
          }}
        />
      )}
    </>
  );
}

/** Sticky booking card (right column): price, dates, guests, Reserve (payments aren't live yet). */
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
  const { range, guests, setGuests, guestFeeBps } = useStay();
  const { rates: choiceRates, room } = useChoiceRates(rates);
  const quote = stayQuote(choiceRates, discountPercent, range);
  const guestFee = quote ? feeOf(quote.total, guestFeeBps) : 0;
  const guestLimit = room?.maxGuests ?? maxGuests;
  const longOnly = !rates.some((r) => r.unit !== "MONTH");
  const headline = headlineRate(rates, longOnly ? "long" : "short") ?? rates[0];
  const others = rates.filter((r) => r !== headline);
  const discounted = Boolean(discountPercent && discountPercent > 0);
  const short = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const date = (iso?: string) => (iso ? short.format(new Date(`${iso}T00:00:00Z`)) : t("addDate"));
  const bold = (chunks: ReactNode) => <span className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink">{chunks}</span>;

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
          {quote ? (
            <>
              {quote.originalTotal && <s className="text-muted">{formatRWF(quote.originalTotal, locale)}</s>}
              {t.rich("perStay", { price: formatRWF(quote.total, locale), count: quote.nights, b: bold })}
            </>
          ) : (
            headline && (
              <>
                {discounted && <s>{formatRWF(headline.price, locale)}</s>}
                {bold(formatRWF(discountedPrice(headline.price, discountPercent), locale))}
                <span>{t(`perUnit.${headline.unit}`)}</span>
              </>
            )
          )}
        </p>

        {room && (
          <p className="mt-3 text-sm text-ink">
            <span className="text-muted">{t("roomLabel")}</span> <b className="font-semibold">{room.name}</b>
          </p>
        )}

        {/* Dates and guests */}
        {!longOnly && (
          <div className="mt-5 overflow-hidden rounded-xl border border-line-strong">
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
                  onClick={scrollToCalendar}
                  className="flex flex-col items-start gap-0.5 px-3.5 py-2.5 text-left transition-colors hover:bg-canvas"
                >
                  <span className="text-xs font-semibold text-ink">{t(label)}</span>
                  <span className={cn("text-sm", value ? "text-ink" : "text-muted")}>{date(value)}</span>
                </button>
              ))}
            </div>
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
          </div>
        )}

        <ReserveButton
          rates={rates}
          discountPercent={discountPercent}
          place={place}
          signedIn={signedIn}
          className="mt-4 w-full rounded-full bg-gradient-to-r from-primary to-[#0a6fe0] py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,87,184,0.8)] transition-[filter,transform] duration-300 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        />
        <p className="mt-3 text-center text-[13px] text-muted">
          {rates.some((r) => r.unit === "NIGHT") ? t("wontBeCharged") : t("bookingSoon")}
        </p>

        {/* Breakdown */}
        {quote && (
          <dl className="mt-5 flex flex-col gap-3 border-t border-line pt-5 text-[15px] tabular-nums">
            <div className="flex justify-between text-ink/80">
              <dt className="underline decoration-line-strong underline-offset-4">{t("nightsTimes", { price: formatRWF(quote.nightly, locale), count: quote.nights })}</dt>
              <dd>{formatRWF(quote.total, locale)}</dd>
            </div>
            {guestFee > 0 && (
              <div className="flex justify-between text-ink/80">
                <dt>{t("serviceFee")}</dt>
                <dd>{formatRWF(guestFee, locale)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-3 font-bold text-ink">
              <dt>{t("total")}</dt>
              <dd>{formatRWF(quote.total + guestFee, locale)}</dd>
            </div>
          </dl>
        )}

        {/* Other ways to rent: hourly / daily / monthly */}
        {others.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-2 text-[13px] font-semibold text-ink">{t("otherRates")}</p>
            <ul className="flex flex-col gap-1.5 text-sm tabular-nums">
              {others.map((rate) => (
                <li key={rate.unit} className="flex justify-between gap-3">
                  <span className="text-ink">
                    <b>{formatRWF(discountedPrice(rate.price, discountPercent), locale)}</b> {t(`perUnit.${rate.unit}`)}
                  </span>
                  {rate.dayStartTime && rate.dayEndTime && (
                    <span className="text-muted">{t("openHours", { start: rate.dayStartTime, end: rate.dayEndTime })}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
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
  const { range } = useStay();
  const { rates: choiceRates } = useChoiceRates(rates);
  const quote = stayQuote(choiceRates, discountPercent, range);
  const longOnly = !rates.some((r) => r.unit !== "MONTH");
  const headline = headlineRate(choiceRates, longOnly ? "long" : "short") ?? choiceRates[0];
  const bold = (chunks: ReactNode) => <b className="text-ink">{chunks}</b>;
  return (
    <div className="fixed inset-x-0 bottom-[calc(82px+env(safe-area-inset-bottom))] z-30 mx-3 flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-4 py-3 shadow-[0_10px_30px_-12px_rgba(16,24,40,0.35)] md:hidden">
      <p className="text-sm text-muted">
        {quote
          ? t.rich("perStay", { price: formatRWF(quote.total, locale), count: quote.nights, b: bold })
          : headline && (
              <>
                {bold(formatRWF(discountedPrice(headline.price, discountPercent), locale))} {t(`perUnit.${headline.unit}`)}
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
