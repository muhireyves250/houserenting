# Space Rental

Rent houses, lodges, apartments and rooms in Rwanda — by the hour, day, night (short-term) or month (from 6 months).
Next.js 16 · PostgreSQL (Neon) · Prisma 7 · Better Auth · next-intl (en / rw / fr).

- Design spec: `docs/superpowers/specs/2026-10-12-space-rental-design.md`
- Phase 1 plan: `docs/superpowers/plans/2026-10-12-phase-1-foundation.md`

## Setup

```bash
pnpm install
cp .env.example .env           # fill DATABASE_URL (Neon direct URL) and BETTER_AUTH_SECRET
echo 'TEST_DATABASE_URL="..."' > .env.test   # a separate database for tests
pnpm db:migrate                # apply migrations to the dev database
pnpm db:seed                   # demo host + 12 demo listings (safe to re-run)
pnpm dev                       # http://localhost:3000
```

Emails are written to `.mail-outbox/` in development (`MAIL_DRIVER=file`) — open the newest file to find verification and reset links.

### Demo account (development only)

| Email | Password | Role |
|---|---|---|
| `host@spacerental.rw` | `SpaceRental-demo-2026` | Host of all demo listings |

The seed refuses to run when `NODE_ENV=production` unless `ALLOW_SEED=1`.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Run, build, serve |
| `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript |
| `pnpm test` | Unit (jsdom) + integration (test database) |
| `pnpm test:e2e` | Playwright on phone and desktop viewports (seeds the test database first) |
| `pnpm db:migrate` / `pnpm db:test:migrate` | Migrate dev / test database |
| `pnpm db:seed` | Seed demo data into the dev database |

## Notes

- On networks without working IPv6, Node needs a longer address-family fallback; `pnpm-workspace.yaml` sets
  `--network-family-autoselection-attempt-timeout=2000` for all scripts.
- Prisma 7: run `pnpm prisma generate` after changing `prisma/schema.prisma` (`migrate dev` no longer does it).
