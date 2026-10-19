# HTTP API

Pages use server actions; these routes are for files, callbacks, links and jobs. All answers are JSON unless noted.
Signed-in routes use the Better Auth session cookie. Every permission is checked on the server.

| Route | Who | What |
|---|---|---|
| `POST /api/v1/payments/callback` | Payment provider (signed) | Confirms or fails a payment. See `docs/payments.md`. |
| `GET /api/v1/jobs/expire-holds` | Vercel Cron (`Bearer CRON_SECRET`) | Daily: releases lapsed holds, sends agreement renewal reminders. |
| `GET /api/v1/locations?q=` | Anyone | Place-name suggestions for search. |
| `POST /api/v1/listings/{id}/documents` | Owner or staff | Upload a private document (multipart `file`, `kind`: `OWNER_ID`, `OWNERSHIP_PROOF`, `MANAGEMENT_AUTHORIZATION`, `OTHER`). PDF/JPG/PNG/WEBP, 8 MB. |
| `GET /api/v1/documents/{id}` | Owner or staff | Download it (never cached; staff views are logged). |
| `POST /api/v1/bookings/{reference}/guest-id` | The guest | Upload their ID when the place asks for it online (multipart `file`). |
| `GET /api/v1/bookings/{reference}/guest-id` | Guest, owner, manager, receptionist, staff | Open the uploaded ID (staff views are logged). |
| `POST /api/v1/me/photo`, `DELETE /api/v1/me/photo` | Signed in | Set (JPG/PNG/WEBP, 2 MB) or remove the profile photo. |
| `GET /api/v1/avatars/{userId}` | Anyone | A profile photo (cached; the link changes with the photo). |
| `GET /api/v1/p/{code}?to=/path` | Anyone | A promoter's QR link: counts the visit once a day, remembers the promoter for 30 days, opens `to` (on-site paths only). |
| `GET /api/v1/admin/export/{kind}` | Staff | CSV for Excel: `bookings`, `payments`, `ledger`, `report` (report takes the Reports page filters: `from`, `to`, `by`, `place`, `owner`, `type`). |
| `/api/auth/*` | Anyone | Sign-up, sign-in, sessions (Better Auth). |

## Permanent links

- Place: `/listings/{id}` (any words after the id are ignored). Hidden, paused, suspended or archived places show
  their status and a way to find another place, never private details, and can't be booked.
- Room: `/rooms/{id}` opens its place with the room chosen.
