# VIIPA handoff: status

What the consolidated handoff (17 Oct 2026) asks for, and where each item stands. "Owner decision" items work in the
system but need VIIPA to decide a policy, a rate or a provider before going live.

## Done

**Places and listings**
- Admin creates and publishes places (for an owner, or operated by VIIPA); owner submissions stay unpublished until approved.
- Statuses: draft, submitted (in review), changes requested, approved/published, rejected, hidden, paused, suspended, archived. Every change has its reason and is in the audit log; owners are notified.
- Hidden, paused, suspended and archived places can't be booked by link or API; their link shows the status only.
- One owner, many places; managers and receptionists per place (Phase 3).
- Categories: apartment, duplex, house, lodge, room, guest house, other.
- Private documents (owner ID, ownership proof, management authorization) for owner and staff only.
- Management agreement start/end: no bookings outside it; reminders and a dashboard pop-up a month before the end.
- Place availability window, days bookings may start, minimum/maximum stay per price.
- Guest ID policy per place (upload online / show at check-in).
- Permanent links for places and rooms.
- Booking by whole place, room by room, or both; by hour, day, night, week, month, year.
- Payout details required and verified before an owner's place first goes live.
- Maintenance / unavailable / booked-elsewhere blocks, whole place or one room, known or open end, kept as history.
- Highlighted places row on the home page.

**Bookings, MY STAY**
- Unique booking numbers, full history, payment holds, payment confirmed only by the provider callback.
- MY STAY tab (phones and computers): stay details, directions, message the host, ID upload, change requests (stay longer, leave earlier, move place, cancel), problem reports, like/dislike feedback, empty state.
- Unpaid holds cancel at once; paid cancellations go through a request with a reason; refunds pending → refunded/declined, recorded in the ledger. No-shows.
- Dislike auto-hide with a configurable limit; staff can keep a place visible, and can show hidden places again.

**Restaurants and orders**
- Restaurants (own or inside a place), menus, cart, orders for pickup, delivery or to the guest's room; nearest first (phone location or the guest's stay); ORDERS tab once a restaurant is live.
- Restaurant manager, kitchen staff and delivery roles; admin publishes and hides restaurants.

**Promoters**
- Apply, approval, personal QR code and link, visits counted once a day, server-side attribution, configurable reward, staff approve and pay rewards. Fraud rules: no self-promotion, finished paid stays only, same guest at most once per 30 days.

**Money and reports**
- Commission per category; fee model add-on or included; customers see one total (no fee rows); each booking keeps the rates used.
- Reports by place, owner, category and date (daily/weekly/monthly/yearly), busiest/quietest days, weekdays, restaurant orders, VAT/CIT estimates at configured rates; Excel (CSV) export and print-to-PDF.

**Accounts and roles**
- Super admin, VIIPA admin, property owner, property manager, receptionist, restaurant manager/staff, delivery, customer — all checked on the server.
- Profile photo; compact profile menu on computers; visible "Add place".
- Admin dashboard sections: overview, listings, bookings, guest requests, restaurants, moderation, support, money, reports, promotions, promoters, users and roles, settings, audit, notifications.

## Owner decisions needed

| Topic | What to decide | Where it's set |
|---|---|---|
| Payment provider | MTN MoMo / Airtel / gateway account, and refunds through it | Provider adapter (`docs/payments.md`) |
| Food order payment | Orders are paid on delivery until an online payment for orders is chosen | — |
| Commission and fees | Default and per-category commission; fee add-on or included | Admin → Settings |
| Taxes | VAT/CIT treatment and rates (reports show estimates only) | Admin → Settings |
| Cancellation and refunds | The policy text; how much is refunded (staff enter the amount per request) | Admin → Settings, Guest requests |
| Extensions | How guests pay the difference for a longer stay (shown to them; collected by staff for now) | — |
| Promoter rewards | Fixed amount or percent, and when to open the programme | Admin → Settings |
| Dislike auto-hide | The number of dislikes (90 days) that hides a place | Admin → Settings |
| Deposits | Deposit percent for monthly rentals and when it's returned | Admin → Settings |

## Not done yet

- Online payment for food orders and automatic refunds through the provider (needs the provider decision).
- Real-time order updates (orders refresh when the page reloads).
- Owner-set refund policy per place within admin limits (refund amounts are decided by staff per request today).
