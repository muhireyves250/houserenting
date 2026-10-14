"use client";

import { useState } from "react";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { BookingTile, type BookingTileData } from "./BookingTile";

type Tab = "upcoming" | "past";

/** Upcoming / Past switch over the guest's bookings, with the site's sliding pill. */
export function BookingsTabs({
  upcoming,
  past,
  labels,
}: {
  upcoming: BookingTileData[];
  past: BookingTileData[];
  labels: { upcoming: string; past: string; noUpcoming: string; noPast: string; group: string };
}) {
  const [tab, setTab] = useState<Tab>(upcoming.length === 0 && past.length > 0 ? "past" : "upcoming");
  const list = tab === "upcoming" ? upcoming : past;
  return (
    <div className="flex flex-col gap-5">
      <SegmentedTabs
        label={labels.group}
        value={tab}
        onChange={setTab}
        options={[
          { value: "upcoming", label: `${labels.upcoming} · ${upcoming.length}` },
          { value: "past", label: `${labels.past} · ${past.length}` },
        ]}
        className="max-w-sm ring-1 ring-line"
      />
      {list.length === 0 ? (
        <p className="py-10 text-center text-[15px] text-muted">{tab === "upcoming" ? labels.noUpcoming : labels.noPast}</p>
      ) : (
        <ul key={tab} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((booking) => (
            <li key={booking.reference} className="motion-safe:animate-pop-in">
              <BookingTile booking={booking} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
