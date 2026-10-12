# Space Rental — Design Spec

**Date:** 2026-10-12
**Status:** Draft for review
**Type:** New product (architectural)

## 1. Purpose and success criteria

Space Rental is a marketplace for renting houses, lodges, apartments and rooms in **Rwanda** (first market). It is a **real product launch**, so it must be production-grade: secure, observable, maintainable and extensible.

Renters can rent:

- **Short-term** — by the **hour**, **day** (day-use) or **night**, according to what each owner allows.
- **Long-term (from 6 months)** — by the month, after booking a **viewing** and choosing a **move-in date**.

Success means:

- A renter can find a place, see it in detail, book a short stay or apply for a long-term viewing, and chat with the host — on phone, tablet and desktop.
- A host can publish a listing (after admin approval), set rates and availability, and approve or decline requests.
- An admin can review listings and manage users.
- Double bookings are impossible.
- The UI is available in English, Kinyarwanda and French.

### Source designs

The supplied mobile designs (iPhone screens) define the visual language and the mobile layout: search home with Short-term / From 6 months pill tabs, date picker, guest sheet, location autocomplete, results list, filters, listing detail (long-term and short-term variants), Make an appointment / Admission schedule, short-term checkout with price breakdown, Bookings (Reservations / Viewing), Chats, splash, onboarding, sign-up and login screens, the "Space Rental" house logo and illustration set. This spec adds tablet and desktop layouts.

### Decisions made

| Topic | Decision |
|---|---|
| Market | Rwanda first; currency RWF |
| Payments | Deferred. Bookings carry a payment status; providers (MTN MoMo, Airtel Money…) plug in later |
| Duration model | Owner enables any of HOUR / DAY / NIGHT (short-term) and MONTH (long-term), each with its own price and limits |
| Hosts | Any user can become a host; listings require admin approval before going live |
| Sign-in at launch | Email + password only (with email verification and password reset) |
| Languages | English (default), Kinyarwanda, French |
| Architecture | Next.js monolith + PostgreSQL |

## 2. Phases

The product is built in phases. Each phase gets its own implementation plan and ships something usable. This spec covers the full architecture and data model so later phases do not force redesigns.

| Phase | Delivers |
|---|---|
| 1. Foundation | Project setup, CI, design system, responsive app shell, i18n, email+password auth, splash/onboarding, profile |
| 2. Listings & host side | Host mode, listing create/edit (photos, details, location), rate options, availability calendar, admin approval queue |
| 3. Search & discovery | Home search, location autocomplete, results list + map, filters, sort, listing detail, favorites |
| 4. Bookings | Short-term booking with host approval, viewing slots and long-term applications, Bookings tab, archive, receipts, notifications |
| 5. Chat & reviews | Realtime guest↔host chat, reviews and ratings after completed stays |
| 6. Payments (later) | MTN MoMo / Airtel Money via `PaymentProvider` |

## 3. Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript (strict), React Server Components + Server Actions |
| Styling | Tailwind CSS with design tokens; headless primitives (Radix UI) for accessible dialogs, popovers, sheets |
| Database | PostgreSQL 16 on Neon (separate dev and test branches; no Docker), Prisma ORM 7 + Prisma Migrate |
| Auth | Better Auth (email + password, email verification, password reset, built-in rate limiting, database sessions), argon2id password hashing |
| Validation | zod (shared between client and server) |
| i18n | next-intl, locale-prefixed routes (`/en`, `/rw`, `/fr`) |
| Images | Cloudinary (via `Storage` adapter) |
| Realtime | Pusher Channels (via `Realtime` adapter) |
| Maps | Google Maps JS + Places autocomplete + geocoding (via `Geo` adapter) |
| Email | Resend (via `Mailer` adapter); localized HTML templates; file-outbox mailer for dev/E2E |
| Testing | Vitest (unit/integration against the Neon test branch locally, a Postgres service in CI), Playwright (E2E) |
| Observability | Sentry, structured JSON logs (pino) |
| Hosting | Docker image deployable to a VPS or Vercel; managed Postgres with daily backups |

## 4. Architecture

### 4.1 Layers

```
UI (pages, components)  ──►  Server Actions / Route Handlers (/api/v1)
                                     │
                                     ▼
                            Feature services  ──►  Prisma (Postgres)
                                     │
                                     ├──►  lib adapters (Mailer, Storage, Geo, Realtime, PaymentProvider, SmsSender)
                                     └──►  Domain events (outbox)
```

- **Only services touch the database.** Pages, server actions and route handlers call services.
- **Services enforce authorization** (renter / host / admin) and business rules, so web UI and API behave identically.
- **All input is validated with zod** at the boundary (server action or route handler) before reaching a service.
- **External vendors are only reached through adapters** in `src/lib/`.

### 4.2 Folder structure

```
src/
  app/
    [locale]/
      (main)/              search home, results, listings/[id], favorites, bookings, chats, profile
      (auth)/              login, signup, verify-email, reset-password
      (onboarding)/        splash, onboarding
      host/                host dashboard: listings, listings/[id]/edit, calendar, requests, viewings
      admin/               review queue, users, listings, audit log
    api/
      v1/                  versioned REST endpoints
      webhooks/[provider]/ signed incoming webhooks
  features/
    auth/  users/  listings/  search/  availability/  pricing/
    bookings/  viewings/  chat/  reviews/  favorites/  admin/  notifications/
      each contains: service.ts, schemas.ts (zod), components/, *.test.ts
  components/ui/           Button, SegmentedTabs, TextField, Calendar, Sheet, Popover, Badge, Chip, Avatar, Tabs…
  lib/
    db.ts  auth.ts  i18n/  storage/  geo/  realtime/  mailer/  payments/  sms/  events/  logger.ts  rate-limit.ts
  messages/en.json  rw.json  fr.json
prisma/
  schema.prisma  migrations/  seed.ts
e2e/                       Playwright tests
```

### 4.3 Integration adapters

Each adapter is a TypeScript interface plus one or more implementations, selected by environment config.

| Interface | Launch implementation | Future options |
|---|---|---|
| `PaymentProvider` | `NoopPaymentProvider` (pay on arrival / arranged with host) | MTN MoMo, Airtel Money, Flutterwave, Stripe |
| `Mailer` | Resend (or SMTP) | SendGrid, Mailgun |
| `SmsSender` | not used at launch | Africa's Talking, Pindo, Twilio |
| `Storage` | Cloudinary | S3, Cloudflare R2 |
| `Realtime` | Pusher | Ably, self-hosted WebSocket |
| `Geo` | Google Maps / Places | Mapbox, OpenStreetMap |

Other integration points:

- **Webhooks:** `/api/webhooks/<provider>` verifies signatures and is idempotent (stores processed event IDs).
- **Domain events:** services write events (`BookingRequested`, `BookingApproved`, `ListingPublished`, `MessageSent`, …) to an `OutboxEvent` table in the same transaction as the change. A worker (cron route or background job) dispatches them to handlers (email, notifications, future analytics/CRM). Events are never lost if a downstream service is down.
- **REST API:** `/api/v1/...` exposes the same services for a future mobile app or partners.

## 5. Data model

All IDs are cuid/uuid strings. All tables have `createdAt` / `updatedAt`. Timestamps are stored in UTC; the display timezone is `Africa/Kigali`.

### User
`id, name, email (unique), emailVerified, passwordHash, phone?, avatarUrl?, locale (en|rw|fr), role (USER|ADMIN), isHost, hostSince?, status (ACTIVE|SUSPENDED)`

Plus Better Auth tables: `Session`, `Account` (holds the password hash), `Verification` (email verification and password reset tokens), `RateLimit`.

### Listing
`id, hostId → User, title, description, type (APARTMENT|DUPLEX|PRIVATE_HOUSE|LODGE|ROOM), status (DRAFT|PENDING_REVIEW|PUBLISHED|REJECTED|ARCHIVED), rejectionReason?, addressLine, district, city, country (default RW), lat, lng, sizeM2, rooms, bedrooms, bathrooms, maxGuests, petsAllowed, facilities (enum[]), characteristics (string[]), termsOfRent (string[]), depositMonths?, discountPercent?, ratingAvg, ratingCount, publishedAt?`

- `facilities` enum: KITCHEN, WIFI, AIR_CONDITIONER, WORKPLACE, WASHING_MACHINE, DISHWASHER, OVEN, MICROWAVE, PARKING, TV, HOT_WATER, SECURITY, GENERATOR, POOL (extendable).
- Free-text fields that hosts write (title, description, characteristics, terms) are stored as entered. They are not machine-translated at launch.

### ListingPhoto
`id, listingId, url, publicId (storage key), width, height, position`

### RateOption
`id, listingId, unit (HOUR|DAY|NIGHT|MONTH), price (Int, RWF), minUnits, maxUnits?, checkInTime?, checkOutTime?, dayStartTime?, dayEndTime?`

- A listing has 1..4 rate options, at most one per unit.
- NIGHT uses `checkInTime` / `checkOutTime` (for example 14:00 / 11:00).
- DAY uses `dayStartTime` / `dayEndTime` (for example 08:00 / 20:00).
- HOUR bookings must fall within the listing's daily open window (`dayStartTime`–`dayEndTime`, if set).
- A listing is **short-term** if it has any HOUR/DAY/NIGHT option, and **long-term** if it has a MONTH option. It can be both.

### AvailabilityBlock
`id, listingId, during (tstzrange), reason (BOOKING|HOLD|HOST_BLOCKED), bookingId?, expiresAt?`

- **Exclusion constraint** (raw SQL migration, `btree_gist` extension): `EXCLUDE USING gist (listingId WITH =, during WITH &&)`. This makes overlapping blocks for the same listing impossible, including under concurrent requests.
- `HOLD` blocks (pending requests) carry `expiresAt`. A scheduled job deletes expired holds and expires the matching bookings.

### Booking (short-term)
`id, listingId, renterId, rateUnit, start, end, units, adults, children, pets, priceSnapshot (Json: unit price, units, subtotal, discount, fees, total), totalAmount (Int RWF), status (PENDING|APPROVED|DECLINED|EXPIRED|CANCELLED|COMPLETED), paymentStatus (NOT_REQUIRED|UNPAID|PAID|REFUNDED), cancelledBy?, cancelReason?, decidedAt?`

### ViewingSlot / Viewing (long-term)
- `ViewingSlot`: `id, listingId, start, end, capacity (default 1)`
- `Viewing`: `id, slotId, listingId, renterId, contactName, contactEmail, contactPhone, desiredMoveIn (date), months, message?, status (PENDING|APPROVED|DECLINED|CANCELLED|COMPLETED)`

### Chat
- `Conversation`: `id, listingId, renterId, hostId, lastMessageAt` (unique on listingId + renterId)
- `Message`: `id, conversationId, senderId, body, createdAt, readAt?`

### Review
`id, bookingId (unique), listingId, authorId, rating (1–5), body, createdAt`. Only allowed after a booking is `COMPLETED`. Listing `ratingAvg` / `ratingCount` are updated in the same transaction.

### Other tables
- `Favorite`: `userId, listingId` (composite primary key)
- `Notification`: `id, userId, type, payload (Json), readAt?`
- `OutboxEvent`: `id, type, payload (Json), status, attempts, availableAt`
- `AuditLog`: `id, actorId, action, targetType, targetId, meta (Json)`. Every admin action is recorded.

### Money
All amounts are integers in RWF (no minor units). Totals are always computed on the server by `pricing.quote()` and saved as a snapshot on the booking.

## 6. Key flows

### 6.1 Becoming a host and publishing
1. A user taps "Become a host" and `isHost` is set to true.
2. The host creates a listing (`DRAFT`) using a multi-step form: type & basics → location (map pin + address) → photos (min 5) → facilities & characteristics → terms → rate options → availability.
3. The host submits it, and it moves to `PENDING_REVIEW`.
4. An admin approves it (`PUBLISHED`, `publishedAt` set) or rejects it (`REJECTED` with a reason). The host is notified either way. Editing a published listing's title, description, photos or location sends it back to review. Editing prices or availability does not.

### 6.2 Search
- **Inputs:** mode (short | long), location (Places autocomplete → lat/lng + bounding box, or district/city), dates or hours + guests (short-term only), filters (price range, size range, types, facilities), sort (price asc/desc, newest, rating).
- **Results:** only `PUBLISHED` listings that have a rate option matching the mode, that fit the guest count, and (short-term with dates) that have no overlapping `AvailabilityBlock`.
- **Date flexibility:** the "Exact dates / ± 1 / ± 2 / ± 3 days" chips from the designs widen the search. A listing matches if the requested stay fits anywhere in the shifted window.
- **Map view:** listings inside the visible map bounds.
- Pagination is cursor-based. Results show the price for the relevant unit, a discount badge, a "New" badge (published within 14 days), rating, and favorite state.

### 6.3 Short-term booking
1. On the listing page, the renter picks a unit (Hourly / Daily / Nightly), the dates or hours, and guests. A live quote comes from `pricing.quote()`.
2. Checkout shows the summary (dates, guests with Change links, price breakdown) and personal data, prefilled from the profile. The payment method section shows "Pay on arrival" until Phase 6.
3. On submit, one transaction does all of this:
   - re-validates the min/max units, opening hours and guest limits
   - recalculates the price
   - inserts a `HOLD` block (24h expiry)
   - creates a `PENDING` booking
   - writes a `BookingRequested` event

   If the exclusion constraint rejects the insert, the renter gets "These dates were just booked" and an updated calendar.
4. The host then has three outcomes:
   - **Approve:** the hold becomes a `BOOKING` block (no expiry) and the booking becomes `APPROVED`.
   - **Decline:** the block is deleted and the booking becomes `DECLINED`.
   - **No response within 24h:** the booking becomes `EXPIRED` and the block is deleted.
5. After `end` passes, a scheduled job marks approved bookings `COMPLETED`, which unlocks a review.
6. **Cancellation:** the renter or host can cancel an `APPROVED` booking before `start`. The block is released. Refund rules arrive with Phase 6.

### 6.4 Long-term viewing
1. The host publishes viewing slots (the "Admission Schedule": dates with time slots).
2. The renter picks a slot, then enters name, email and phone (prefilled), desired move-in date and number of months (≥ the listing's minimum), plus an optional message. This creates a `PENDING` viewing.
3. If the host approves, the conversation opens automatically with a system message. If declined, the renter is notified.
4. After the viewing, the lease itself is arranged between host and renter. Tracking leases in-app is out of scope.

### 6.5 Chat
- A renter can start a conversation from a listing ("Contact host"). Approved bookings and viewings also create one automatically.
- Messages go to Postgres and are pushed over a private Pusher channel per conversation. The channel is authorized by the server, so only participants can join.
- The chat list shows the last message, time, unread count and read ticks.

### 6.6 Notifications
Domain events produce in-app notifications plus emails in the user's locale, for: booking requested / approved / declined / expired / cancelled, viewing requested / approved / declined, listing approved / rejected, and new message (email only if unread after 10 minutes).

## 7. Responsive UI

### 7.1 Breakpoints
- **Mobile** < 768px: matches the supplied designs.
- **Tablet** 768–1279px: two-column layouts where noted.
- **Desktop** ≥ 1280px: full web layout, content max-width ~1280px.

### 7.2 Design tokens
- Primary blue (≈ `#0057B8`, matched against the designs), dark pill selection (≈ `#3A3D42`), and a light grey background (≈ `#F2F2F2`).
- White cards with ~16px radius, fully rounded buttons, and underline-style text fields with leading icons.
- Typography: Inter (UI). The serif from the brand book is for marketing headers only.
- Brand: the "Space Rental" open-house logo and the blue illustration set.
- All tokens are CSS variables, so a dark theme can be added later.

### 7.3 Layout per screen

| Screen | Mobile | Tablet / Desktop |
|---|---|---|
| App shell | Bottom tab bar: Search, Favorites, Bookings, Chats, Profile | Top header: logo · Search · Favorites · Bookings · Chats · Become a host · language switcher · avatar menu |
| Home | "Find your new home" + pill tabs + stacked search card | Full-width photo hero, pill tabs, **horizontal** search bar (Location \| Dates \| Guests \| Search; long-term hides Dates/Guests); featured listings, popular districts, "How it works" using onboarding illustrations |
| Date picker | Full-screen (Choose dates / Flexible dates, flexibility chips) | Popover under the search bar, two months side by side; hour-range selector for hourly listings |
| Guests | Bottom sheet (Adults / Children / Pets) | Popover |
| Location search | Full-screen autocomplete | Dropdown under the field |
| Results | List of cards; filter icon opens a full-screen Filters sheet | Filter bar (Price, Type, Facilities, Size, Sort). Desktop: 2-column card grid + sticky map with price pins. Tablet: 2-column grid + "Map" toggle |
| Listing detail | As designed; sticky Book / Apply for viewing button | Photo mosaic (1 large + 4, "Show all photos"); two columns: content (title, rating, tags, description, characteristics, facilities, terms, map, reviews, host) + sticky booking card (unit toggle, price, dates, guests, breakdown, CTA) |
| Checkout / Make an appointment | As designed | Form on the left, summary card on the right |
| Admission schedule | As designed | Calendar and time slots side by side |
| Bookings | Reservations / Viewing tabs, grouped by status, archive button | List on the left, selected booking detail (host, payment info, receipt) on the right |
| Chats | List → thread | Two panes: list + thread |
| Favorites | Card list | Card grid |
| Auth | As designed | Split screen: illustration on the left, form on the right |
| Splash / onboarding | First launch only (PWA) | Not shown; landing page instead |
| Host dashboard / Admin | Menu + stacked content | Sidebar navigation + content (tables, calendars) |

### 7.4 Accessibility and performance
- Accessibility: WCAG 2.1 AA contrast, keyboard navigation, focus-visible styles, labelled form controls, alt text for listing photos (host-provided caption or generated from title).
- Images: served through Next/Image with Cloudinary transforms (responsive sizes, WebP/AVIF).
- Target: LCP < 2.5s on mid-range Android over 4G for home and listing pages.
- The app is installable as a PWA (manifest + icons).

## 8. Internationalization
- Locales `en` (default), `rw`, `fr`, prefixed in the URL. The first visit's locale is detected from `Accept-Language`; after that, the user's choice is saved on their profile.
- All UI strings, emails and validation messages are translated. Dates and numbers use `Intl`, with RWF formatting (`RWF 45,000`).
- Host-written content is shown as entered.

## 9. Security
- Passwords: argon2id hashes; minimum length 8; checked against a common-password list.
- Email verification is required before booking, hosting or messaging.
- Rate limiting (Postgres-backed; Better Auth's limiter for auth endpoints) on login, signup, password reset, booking creation and messaging.
- Authorization checks inside services. Resources the user may not access return 404.
- Server Actions are CSRF-protected by Next.js. API routes use the session cookie (SameSite=Lax) or, for the future mobile app, bearer tokens.
- Security headers: CSP, HSTS, X-Frame-Options, Referrer-Policy.
- Uploads go directly to Cloudinary with server-signed parameters. Only image types are allowed, max 10MB.
- Admin area restricted to `role = ADMIN`; all admin actions written to `AuditLog`.
- Personal data (phone, email) shown to a host only for approved bookings/viewings.
- Secrets come from environment variables only. `.env.example` is committed; `.env` is ignored.

## 10. Error handling
- **Validation errors** are returned per field and translated.
- **Known business errors** (`DatesUnavailable`, `BelowMinimumStay`, `OutsideOpeningHours`, `ListingNotBookable`, `NotAuthorized`…) are typed error classes that map to friendly messages and HTTP codes.
- **Unexpected errors** are logged with a request ID, reported to Sentry, and show a translated error page with a retry option.
- **Background jobs** (outbox dispatch, hold expiry, completion) are idempotent and retried with backoff. Failures after N attempts are flagged for admin attention.

## 11. Testing
- **Unit tests (Vitest):** pricing quotes (all units, discounts, min/max), availability range calculations, status transitions, permission rules.
- **Integration tests:** services against a real Postgres in CI, including the exclusion constraint under concurrent booking attempts.
- **E2E tests (Playwright)** on mobile and desktop viewports:
  - sign up → verify → search → book → host approves
  - long-term viewing application
  - host creates listing → admin approves
  - chat
- **CI (GitHub Actions)** runs lint, typecheck, unit + integration tests, build and E2E on every push and pull request.

## 12. Operations
- Environments: development (Neon dev branch), staging, production. Tests use a separate Neon test branch locally and a Postgres service in CI.
- Prisma migrations are applied in the deploy pipeline. No manual schema edits.
- Daily automated database backups with a tested restore procedure.
- Scheduled jobs (hold expiry, booking completion, outbox dispatch) run as cron-triggered, authenticated route handlers.
- A seed script provides demo data for development and staging.

## 13. Out of scope (for now)
- Online payments, refunds and payouts (Phase 6)
- Phone OTP and social login (adapters ready; not enabled at launch)
- Machine translation of host content
- In-app lease contracts and rent collection for long-term rentals
- Native mobile apps (the REST API is ready for them)
- The "Flexible dates" tab (e.g. "a weekend in November"). Only exact dates ± N days are supported at launch (see 6.2).
