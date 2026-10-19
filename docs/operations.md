# Operations: migrations, deployment, rollback

## Environments

| | Database | App |
|---|---|---|
| Production | Neon (`DATABASE_URL` in Vercel and in local `.env`) | Vercel, deploys every push to `main` |
| Tests | Separate Neon database (`TEST_DATABASE_URL` in `.env.test`) | `pnpm test:int`, `pnpm test:e2e` |

Development and production share one Neon database. Never seed demo data there (`ALLOW_DEMO_SEED` stays unset on
Vercel and in `.env` used against production). Browser checks run against the test database.

On networks where Node times out reaching Neon, prefix commands with
`NODE_OPTIONS=--network-family-autoselection-attempt-timeout=5000`.

## Changing the database

1. Edit `prisma/schema.prisma`, then `pnpm prisma generate`.
2. Create the migration SQL (from the schema in git, or from the test database):
   `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` (run through
   `tsx scripts/with-test-db.ts` to compare with the test database).
3. Check it by hand. **Remove** any `DROP INDEX "booking_listingId_startAt_idx"` or changes to the
   `booking_no_overlap` exclusion constraint: those are written by hand in earlier migrations (double-booking
   protection) and Prisma can't describe them.
4. Save it as `prisma/migrations/<yyyymmddhhmmss>_<name>/migration.sql`.
5. `pnpm db:test:migrate`, add new tables to `TABLES` in `src/test/db.ts`, run the tests.

Migrations only add things (new tables, columns with defaults, new enum values), so the app running before the
migration keeps working after it. That is what makes the order below safe.

## Releasing

```bash
pnpm lint && pnpm typecheck && pnpm test:unit
pnpm test:int                              # ~15 min on the test database
npx prisma migrate deploy                  # production database (uses .env)
git push origin main                       # Vercel builds and deploys
```

Then open the live site: home, a listing, sign-in, `/admin`.

The daily job (`vercel.json` cron → `/api/v1/jobs/expire-holds`, `Authorization: Bearer $CRON_SECRET`) releases
lapsed payment holds and sends management-agreement renewal reminders (30 and 7 days before the end).

## Rolling back

- **App:** in Vercel → Deployments, promote the previous deployment (instant), or `git revert` the commit and push.
- **Database:** migrations are additive, so the previous app version runs on the new schema; normally nothing to
  undo. If a migration must be undone, write a new migration that reverses it (never edit or delete an applied
  one), apply it with `prisma migrate deploy`, and restore data from Neon's point-in-time restore if needed.
- Enum values added to Postgres can't be removed in place; leave them unused.

## Staff access

`pnpm admin:grant someone@example.com` gives staff (VIIPA admin) access; add `--super` for a super admin.
Once a super admin exists, only super admins can give or remove staff access in Admin → Users.
