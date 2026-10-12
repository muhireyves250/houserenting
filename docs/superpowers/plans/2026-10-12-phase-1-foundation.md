# Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployable Next.js app for Space Rental with these pieces in place:
- the design system
- a responsive app shell (bottom tabs on mobile, header on desktop)
- three locales: en, rw and fr
- email + password auth with verification and reset
- mobile onboarding
- an editable profile
- CI covering unit, integration and E2E tests

**Architecture:** A single Next.js App Router app.
- Pages call feature services in `src/features/*`, and only services touch Prisma.
- External vendors (email for now) sit behind adapters in `src/lib/`.
- Better Auth owns sessions, verification and reset tokens, and auth rate limiting, stored in Postgres (Neon).
- next-intl provides locale-prefixed routes.

**Tech Stack:**
- Node 24, pnpm 12
- Next.js 16.4.0, React 19, TypeScript, Tailwind CSS 4
- Prisma 7.10.0 with `@prisma/adapter-pg`, Postgres on Neon
- Better Auth 1.7.7, next-intl 4.14.9, zod 4
- Vitest 5, Testing Library, Playwright 1.64
- pino, Sentry, Resend

**Spec:** `docs/superpowers/specs/2026-10-12-space-rental-design.md` (sections 3, 4, 5 "User", 7, 8, 9, 10, 11, 12).

## Prerequisites (human)

1. **Neon project.** Create a free project at https://neon.tech with two branches: `main` (dev) and `test`. Copy each branch's **direct** (non-pooled) connection string. It looks like `postgresql://...@ep-xxx.REGION.aws.neon.tech/neondb?sslmode=require`, with no `-pooler` in the host.
2. **Brand assets (optional for this phase).** Export the logo as SVG and the onboarding illustrations as SVG from Figma, and save them to `public/brand/`. The plan ships a hand-drawn logo mark and icon-based onboarding art that can be swapped later without code changes elsewhere.

## Global Constraints

- Node `>=24`, pnpm `12.x` (pinned through `packageManager`). Do not use Docker anywhere.
- Locales are exactly `en` (default), `rw` and `fr`. URLs are always prefixed (`/en/...`). The timezone is `Africa/Kigali`.
- Money is an integer number of RWF, displayed as `RWF 45,000` in English.
- Primary blue is `#0057b8`, the dark pill is `#3a3d42` and the canvas is `#f2f2f2`. Cards use a ~16px radius and buttons are fully rounded. The UI font is Inter.
- Breakpoints:
  - mobile `< 768px`: bottom tab bar, matches the supplied designs
  - tablet `768–1279px`
  - desktop `≥ 1280px`: top header, content max-width ~1280px
- Only services in `src/features/*/service.ts` and Better Auth touch the database.
- Every user-facing string comes from `messages/{en,rw,fr}.json`. No hard-coded copy in components, except the brand name "Space Rental".
- Passwords:
  - length 8–128
  - hashed with argon2id
  - rejected if they appear in the common-password list
- Email verification is required before sign-in.
- Rate limits:
  - sign-in and sign-up: 5 per minute per IP
  - password-reset and verification-email requests: 3 per minute per IP

## Review Focus

1. **Integration tests wiping a real database:** if `.env.test` is missing or points at the dev database, tests must refuse to run instead of truncating dev data. Covered in Task 2.
2. **Open redirect through `?next=`:** values such as `//evil.com`, `https://evil.com` or `/\evil.com` must fall back to `/`. Covered in Task 6.
3. **Locale files drifting apart:** a key or ICU placeholder (`{email}`) present in `en` but missing or renamed in `rw` or `fr` must fail CI. Covered in Task 4.
4. **Email provider outage during sign-up:** sign-up must still succeed, with the failure logged rather than surfaced as a 500. Covered in Task 6.
5. **Hand-edited or garbage search URLs** (`?mode=xyz&guests=-4&checkIn=2026-02-31`): the search page must render with sanitized values, not crash. Covered in Task 10.

## File Map

```
.github/workflows/ci.yml                 CI: lint, typecheck, unit+integration, build, E2E
pnpm-workspace.yaml                      pnpm 12 allowBuilds list
next.config.ts                           next-intl plugin, security headers, server externals
prisma.config.ts, prisma/schema.prisma   Prisma 7 config + Better Auth tables + User fields
vitest.config.ts, vitest.setup.ts, vitest.int.setup.ts
playwright.config.ts
scripts/with-test-db.ts                  runs a command with DATABASE_URL=TEST_DATABASE_URL
messages/en.json rw.json fr.json         all UI, email and error copy
src/proxy.ts                             next-intl locale routing (Next 16 "proxy")
src/global.d.ts                          next-intl typed messages/locales
src/instrumentation.ts, src/instrumentation-client.ts   Sentry
src/i18n/routing.ts navigation.ts request.ts messages.ts
src/lib/cn.ts env.ts db.ts logger.ts format.ts safe-redirect.ts zod-errors.ts
src/lib/mailer/{types,memory,file,resend,index}.ts
src/lib/auth.ts auth-client.ts session.ts
src/test/{db.ts,render.tsx,empty.ts}
src/features/auth/{constants,password,common-passwords,schemas,errors,emails}.ts + components/*
src/features/users/{schemas,service,actions}.ts + components/*
src/features/search/params.ts + components/HomeSearch.tsx
src/features/onboarding/constants.ts + components/*
src/components/ui/{Button,TextField,SegmentedTabs,Logo,EmptyState,Avatar,PageContainer}.tsx
src/components/shell/{nav-items.ts,BottomTabBar,HeaderNav,SiteHeader,LocaleSwitcher}.tsx
src/app/layout.tsx, not-found.tsx, manifest.ts, icon.svg, globals.css
src/app/api/auth/[...all]/route.ts
src/app/[locale]/layout.tsx error.tsx not-found.tsx [...rest]/page.tsx welcome/page.tsx
src/app/[locale]/(main)/{layout,page}.tsx search/ favorites/ bookings/ chats/ profile/
src/app/[locale]/(auth)/layout.tsx login/ signup/ check-email/ verified/ forgot-password/ reset-password/
e2e/support/*.ts, e2e/*.spec.ts
```

---

### Task 1: Scaffold the app, tooling and CI skeleton

**Files:**
- Create: whole Next.js scaffold, `pnpm-workspace.yaml`, `vitest.config.ts`, `vitest.setup.ts`, `src/test/empty.ts`, `src/lib/cn.ts`, `src/lib/cn.test.ts`, `.github/workflows/ci.yml`
- Modify: `.gitignore`, `package.json`, `eslint.config.mjs`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string` from `@/lib/cn`, plus the scripts `pnpm lint | typecheck | test | test:unit | test:int | build`.

- [ ] **Step 1: Scaffold without installing**

The scaffolder writes its own `.gitignore`, so remove ours first. `docs/` and `.git` are allowed in the target directory.

```bash
cd /home/ebenezer/Projects/house
rm .gitignore
pnpm dlx create-next-app@16.4.0 . --ts --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-pnpm --skip-install --disable-git --yes
```
Expected: `src/app/{layout,page}.tsx`, `src/app/globals.css`, `eslint.config.mjs`, `next.config.ts` and `package.json` exist.

- [ ] **Step 2: Allow build scripts, pin pnpm, install**

pnpm 12 fails installs with `ERR_PNPM_IGNORED_BUILDS` unless packages with build scripts are listed. Create `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  "@prisma/engines": true
  prisma: true
  "@tailwindcss/oxide": true
  esbuild: true
  sharp: true
  unrs-resolver: true
```

```bash
pnpm pkg set packageManager="pnpm@$(pnpm -v)"
pnpm pkg set engines.node=">=24"
pnpm install
```
If the install still reports `Ignored build scripts: <pkg>` for a well-known build tool, add `<pkg>: true` and re-run. Expected: install completes.

- [ ] **Step 3: Restore our ignore rules**

Append to `.gitignore`:

```gitignore
# local env & generated
!.env.example
.env.test
src/generated/
.mail-outbox/
.e2e-mail/
playwright-report/
test-results/
```

- [ ] **Step 4: Add test tooling and utility deps**

```bash
pnpm add clsx@2.1.1 tailwind-merge@3.7.0 lucide-react@1.55.0 zod@4.6.6 server-only@0.0.1
pnpm add -D vitest@5.0.4 @vitejs/plugin-react@6.1.2 vite-tsconfig-paths@6.1.1 jsdom@30.1.2 \
  @testing-library/react@16.3.3 @testing-library/user-event@14.6.7 @testing-library/jest-dom@7.0.1 \
  tsx@4.23.15 dotenv@18.0.7
```

- [ ] **Step 5: Configure Vitest**

There are two projects:
- `unit` runs in jsdom and covers every `*.test.ts(x)`.
- `integration` runs in node and covers `*.int.test.ts`, one file at a time, because it shares a database.

`server-only` throws outside React Server Components, so it is aliased to an empty module in tests.

`src/test/empty.ts`:
```ts
export {};
```

`vitest.config.ts`:
```ts
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: { "server-only": fileURLToPath(new URL("./src/test/empty.ts", import.meta.url)) },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.int.test.ts", "node_modules/**"],
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.int.test.ts"],
          environment: "node",
          setupFiles: ["./vitest.int.setup.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
```

`vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());
```

Create a temporary `vitest.int.setup.ts` so the integration project resolves. Task 2 replaces it.
```ts
export {};
```

- [ ] **Step 6: Write the failing test for `cn`**

`src/lib/cn.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });

  it("lets later Tailwind utilities win over earlier conflicting ones", () => {
    expect(cn("px-2 text-sm", "px-4")).toBe("text-sm px-4");
  });
});
```

- [ ] **Step 7: Run it and confirm it fails**

Run: `pnpm vitest run --project unit src/lib/cn.test.ts`
Expected: FAIL with "Failed to resolve import "./cn"".

- [ ] **Step 8: Implement `cn`**

`src/lib/cn.ts`:
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 9: Run it and confirm it passes**

Run: `pnpm vitest run --project unit src/lib/cn.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 10: Scripts, lint ignores, CI skeleton**

```bash
pnpm pkg set scripts.lint="eslint ."
pnpm pkg set scripts.typecheck="tsc --noEmit"
pnpm pkg set scripts.test="vitest run"
pnpm pkg set scripts.test:unit="vitest run --project unit"
pnpm pkg set scripts.test:int="vitest run --project integration"
pnpm pkg set scripts.test:watch="vitest"
```

In `eslint.config.mjs`, add these entries to the existing `globalIgnores([...])` array: `"src/generated/**"`, `"playwright-report/**"`, `"test-results/**"`, `".mail-outbox/**"`, `".e2e-mail/**"`.

`.github/workflows/ci.yml` (Task 12 extends it with database and E2E steps):
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test:unit
      - run: pnpm build
```

- [ ] **Step 11: Verify everything is green**

Run: `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm build`
Expected: all succeed. The build prints the default create-next-app route `/`.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 app with Vitest and CI"
```

---

### Task 2: Database (Prisma 7 + Neon) with guarded test database

**Files:**
- Create: `prisma.config.ts`, `prisma/schema.prisma`, `prisma/migrations/*` (generated), `src/lib/db.ts`, `src/test/db.ts`, `scripts/with-test-db.ts`, `.env.example`, `.env` and `.env.test` (local only, gitignored), `src/lib/db.int.test.ts`
- Modify: `vitest.int.setup.ts`, `package.json`

**Interfaces:**
- Produces:
  - `db: PrismaClient` from `@/lib/db`
  - the generated client and enums `Role` / `UserStatus` from `@/generated/prisma/client`
  - `resetDb(): Promise<void>` from `@/test/db`
  - the scripts `pnpm db:migrate`, `db:deploy`, `db:test:migrate`
- Tables (`@@map` names): `user`, `session`, `account`, `verification`, `rateLimit`. These are the shapes Better Auth 1.7 expects.

- [ ] **Step 1: Install Prisma**

```bash
pnpm add @prisma/client@7.10.0 @prisma/adapter-pg@7.10.0
pnpm add -D prisma@7.10.0
```

- [ ] **Step 2: Env files**

`.env.example` (committed):
```bash
# Neon "main" branch, DIRECT connection string (no "-pooler" in host)
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx.REGION.aws.neon.tech/neondb?sslmode=require"

# Better Auth: generate the secret with `openssl rand -base64 32`
BETTER_AUTH_SECRET="replace-with-at-least-32-random-characters"
BETTER_AUTH_URL="http://localhost:3000"

# Email: file (writes JSON to MAIL_OUTBOX_DIR) | resend | memory
MAIL_DRIVER="file"
MAIL_OUTBOX_DIR=".mail-outbox"
MAIL_FROM="Space Rental <no-reply@spacerental.rw>"
RESEND_API_KEY=""

RATE_LIMIT_ENABLED="true"
LOG_LEVEL="info"
SENTRY_DSN=""
NEXT_PUBLIC_SENTRY_DSN=""

# .env.test (not committed) must contain:
# TEST_DATABASE_URL="<Neon 'test' branch DIRECT connection string>"
```

Create the local `.env` by copying `.env.example` and filling in the real Neon `main` URL and a generated secret. Create `.env.test` containing only `TEST_DATABASE_URL="<Neon test branch URL>"`. Both files are gitignored.

- [ ] **Step 3: Prisma config and schema**

`prisma.config.ts`:
```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});
```

`prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum Role {
  USER
  ADMIN
}

enum UserStatus {
  ACTIVE
  SUSPENDED
}

model User {
  id            String     @id
  name          String
  email         String     @unique
  emailVerified Boolean    @default(false)
  image         String?
  phone         String?
  locale        String     @default("en")
  role          Role       @default(USER)
  isHost        Boolean    @default(false)
  status        UserStatus @default(ACTIVE)
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  sessions      Session[]
  accounts      Account[]

  @@map("user")
}

model Session {
  id        String   @id
  expiresAt DateTime
  token     String   @unique
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@map("session")
}

model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([userId])
  @@map("account")
}

model Verification {
  id         String   @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([identifier])
  @@map("verification")
}

model RateLimit {
  id          String @id
  key         String @unique
  count       Int
  lastRequest BigInt

  @@map("rateLimit")
}
```

- [ ] **Step 4: Prisma client singleton**

`src/lib/db.ts`:
```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForDb = globalThis as unknown as { db?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const db = globalForDb.db ?? createClient();

if (process.env.NODE_ENV !== "production") globalForDb.db = db;
```

- [ ] **Step 5: Test-database runner and scripts**

`scripts/with-test-db.ts`:
```ts
import { spawn } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env.test", quiet: true });

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error("TEST_DATABASE_URL is not set. Put it in .env.test (see .env.example).");
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("usage: tsx scripts/with-test-db.ts <command> [...args]");
  process.exit(1);
}

const child = spawn(command, args, {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});
child.on("exit", (code) => process.exit(code ?? 1));
```

```bash
pnpm pkg set scripts.postinstall="prisma generate"
pnpm pkg set scripts.db:migrate="prisma migrate dev"
pnpm pkg set scripts.db:deploy="prisma migrate deploy"
pnpm pkg set scripts.db:studio="prisma studio"
pnpm pkg set scripts.db:test:migrate="tsx scripts/with-test-db.ts prisma migrate deploy"
```

- [ ] **Step 6: Create the migration (dev) and apply it (test)**

```bash
pnpm db:migrate --name init
pnpm db:test:migrate
```
Expected:
- `prisma/migrations/<timestamp>_init/migration.sql` is created.
- "Your database is now in sync" is printed for dev.
- "All migrations have been successfully applied" is printed for test.

- [ ] **Step 7: Guarded integration setup and `resetDb`**

`vitest.int.setup.ts` (replaces the placeholder):
```ts
import { existsSync, readFileSync } from "node:fs";
import { config, parse } from "dotenv";
import { afterAll } from "vitest";

config({ path: ".env.test", quiet: true });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error("TEST_DATABASE_URL is not set. Add it to .env.test (see .env.example).");
}
if (existsSync(".env")) {
  const devUrl = parse(readFileSync(".env")).DATABASE_URL;
  if (devUrl && devUrl === testUrl) {
    throw new Error("TEST_DATABASE_URL equals the dev DATABASE_URL in .env. Refusing to run tests against dev data.");
  }
}

process.env.DATABASE_URL = testUrl;
process.env.ALLOW_DB_RESET = "1";
process.env.MAIL_DRIVER = "memory";
process.env.BETTER_AUTH_URL ??= "http://localhost:3100";
process.env.BETTER_AUTH_SECRET ??= "integration-test-secret-0123456789abcdef";

afterAll(async () => {
  const { db } = await import("@/lib/db");
  await db.$disconnect();
});
```

`src/test/db.ts`:
```ts
import { db } from "@/lib/db";

const TABLES = ["rateLimit", "verification", "session", "account", "user"];

export async function resetDb(): Promise<void> {
  if (process.env.ALLOW_DB_RESET !== "1") {
    throw new Error("resetDb() refused: ALLOW_DB_RESET is not set. Only the integration test setup may wipe the database.");
  }
  const list = TABLES.map((t) => `"${t}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
```

- [ ] **Step 8: Write the failing integration test**

`src/lib/db.int.test.ts`:
```ts
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";

describe("database", () => {
  beforeEach(resetDb);

  it("creates users with launch defaults", async () => {
    const user = await db.user.create({ data: { id: "u1", name: "Alona", email: "alona@example.com" } });
    expect(user).toMatchObject({ role: "USER", isHost: false, locale: "en", status: "ACTIVE", emailVerified: false, phone: null });
  });

  it("rejects a second user with the same email", async () => {
    await db.user.create({ data: { id: "u1", name: "A", email: "same@example.com" } });
    await expect(db.user.create({ data: { id: "u2", name: "B", email: "same@example.com" } })).rejects.toMatchObject({ code: "P2002" });
  });

  it("resetDb refuses to run when ALLOW_DB_RESET is not set", async () => {
    delete process.env.ALLOW_DB_RESET;
    try {
      await expect(resetDb()).rejects.toThrow(/refused/);
    } finally {
      process.env.ALLOW_DB_RESET = "1";
    }
  });
});
```

- [ ] **Step 9: Run it**

Run: `pnpm test:int`
Expected: PASS (3 tests). If it fails with "TEST_DATABASE_URL is not set", finish Step 2.

To confirm the guard works, temporarily set `.env.test`'s URL equal to `.env`'s `DATABASE_URL`, run `pnpm test:int`, and expect "Refusing to run tests against dev data". Then restore the file.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(db): add Prisma 7 schema, Neon config and guarded test database"
```

---
### Task 3: Design tokens and UI primitives

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/components/ui/{Button,TextField,SegmentedTabs,Logo,EmptyState,Avatar,PageContainer}.tsx`, `src/components/ui/{Button,TextField,SegmentedTabs,Avatar}.test.tsx`

**Interfaces:**
- Consumes: `cn` (Task 1).
- Produces:
  - `Button(props: ComponentProps<"button"> & { variant?: "primary"|"outline"|"ghost"|"dark"; size?: "md"|"lg"; fullWidth?: boolean; loading?: boolean })`
  - `buttonClasses(opts?: { variant?; size?; fullWidth?; className? }): string` (for styling links)
  - `TextField(props: Omit<ComponentProps<"input">,"id"> & { label: string; icon?: ReactNode; error?: string; hint?: string; id?: string; hideLabel?: boolean; trailing?: ReactNode })`
  - `SegmentedTabs<T extends string>({ options: {value:T;label:string}[]; value: T; onChange(v:T): void; label: string; className? })`
  - `Logo({ withWordmark?, className? })`, `LogoMark({ className? })`
  - `EmptyState({ icon?, title, body, action? })`
  - `Avatar({ name, className? })`, `initials(name: string): string`
  - `PageContainer(props: ComponentProps<"div">)`
- Tailwind color tokens: `primary`, `primary-hover`, `primary-soft`, `ink`, `muted`, `line`, `surface`, `canvas`, `pill`, `success`, `warning`, `danger`. Radius token: `rounded-card`.

- [ ] **Step 1: Design tokens**

Replace `src/app/globals.css` with:
```css
@import "tailwindcss";

@theme {
  --color-primary: #0057b8;
  --color-primary-hover: #004a9c;
  --color-primary-soft: #dce6f5;
  --color-ink: #1a1c1e;
  --color-muted: #6b7075;
  --color-line: #d9dbde;
  --color-surface: #ffffff;
  --color-canvas: #f2f2f2;
  --color-pill: #3a3d42;
  --color-success: #1f9d45;
  --color-warning: #f29d0a;
  --color-danger: #d93025;
  --radius-card: 1rem;
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
}

html {
  -webkit-tap-highlight-color: transparent;
}
```

- [ ] **Step 2: Write failing tests**

`src/components/ui/Button.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, buttonClasses } from "./Button";

describe("Button", () => {
  it("defaults to type=button so it never submits forms by accident", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveAttribute("type", "button");
  });

  it("is disabled and busy while loading", async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("applies the primary variant by default and outline on request", () => {
    expect(buttonClasses()).toContain("bg-primary");
    expect(buttonClasses({ variant: "outline" })).toContain("border-line");
  });
});
```

`src/components/ui/TextField.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextField } from "./TextField";

describe("TextField", () => {
  it("associates the label with the input", () => {
    render(<TextField label="Email" name="email" />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("name", "email");
  });

  it("keeps a visually hidden label accessible", () => {
    render(<TextField label="Location" hideLabel placeholder="Location" />);
    expect(screen.getByLabelText("Location")).toBeInTheDocument();
  });

  it("marks the input invalid and announces the error", () => {
    render(<TextField label="Email" error="Enter a valid email address." />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter a valid email address.");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");
  });

  it("shows a hint when there is no error", () => {
    render(<TextField label="Password" hint="At least 8 characters." />);
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("At least 8 characters.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
```

`src/components/ui/SegmentedTabs.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SegmentedTabs } from "./SegmentedTabs";

const options = [
  { value: "short", label: "Short-term" },
  { value: "long", label: "From 6 months" },
] as const;

describe("SegmentedTabs", () => {
  it("marks the selected option", () => {
    render(<SegmentedTabs label="Rental type" options={[...options]} value="short" onChange={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: "Rental type" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Short-term" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "From 6 months" })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange on click", async () => {
    const onChange = vi.fn();
    render(<SegmentedTabs label="Rental type" options={[...options]} value="short" onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "From 6 months" }));
    expect(onChange).toHaveBeenCalledWith("long");
  });

  it("moves selection with arrow keys, wrapping around", async () => {
    const onChange = vi.fn();
    render(<SegmentedTabs label="Rental type" options={[...options]} value="short" onChange={onChange} />);
    screen.getByRole("radio", { name: "Short-term" }).focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenLastCalledWith("long");
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
```

`src/components/ui/Avatar.test.tsx`:
```tsx
import { describe, expect, it } from "vitest";
import { initials } from "./Avatar";

describe("initials", () => {
  it("uses first and last name initials", () => {
    expect(initials("Alona Kotilevska")).toBe("AK");
    expect(initials("Jean Paul Habimana")).toBe("JH");
  });
  it("handles single names, extra spaces and accents", () => {
    expect(initials("  émile  ")).toBe("É");
  });
  it("falls back for empty names", () => {
    expect(initials("   ")).toBe("?");
  });
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `pnpm test:unit src/components/ui`
Expected: FAIL (modules not found).

- [ ] **Step 4: Implement the primitives**

`src/components/ui/Button.tsx`:
```tsx
import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "outline" | "ghost" | "dark";
type Size = "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  outline: "border border-line bg-surface text-ink hover:bg-canvas",
  ghost: "text-muted hover:text-ink",
  dark: "bg-pill text-white hover:bg-ink",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: { variant?: Variant; size?: Size; fullWidth?: boolean; className?: string } = {}): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    "disabled:cursor-not-allowed disabled:opacity-50",
    size === "md" ? "h-11 px-5 text-sm" : "h-14 px-8 text-base",
    VARIANTS[variant],
    fullWidth && "w-full",
    className,
  );
}

export type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
};

export function Button({
  variant,
  size,
  fullWidth,
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, fullWidth, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
```

`src/components/ui/TextField.tsx`:
```tsx
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TextFieldProps = Omit<ComponentProps<"input">, "id"> & {
  label: string;
  icon?: ReactNode;
  error?: string;
  hint?: string;
  id?: string;
  hideLabel?: boolean;
  trailing?: ReactNode;
};

export function TextField({ label, icon, error, hint, id, hideLabel = false, trailing, className, ...props }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const descriptionId = `${inputId}-description`;
  const description = error ?? hint;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={inputId} className={cn("text-sm text-muted", hideLabel && "sr-only")}>
        {label}
      </label>
      <div
        className={cn(
          "flex items-center gap-3 border-b py-2 transition-colors focus-within:border-primary",
          error ? "border-danger" : "border-line",
        )}
      >
        {icon && (
          <span className="text-muted [&>svg]:size-5" aria-hidden="true">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted"
          aria-invalid={error ? true : undefined}
          aria-describedby={description ? descriptionId : undefined}
          {...props}
        />
        {trailing}
      </div>
      {description && (
        <p id={descriptionId} role={error ? "alert" : undefined} className={cn("text-xs", error ? "text-danger" : "text-muted")}>
          {description}
        </p>
      )}
    </div>
  );
}
```

`src/components/ui/SegmentedTabs.tsx`:
```tsx
"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export type SegmentedOption<T extends string> = { value: T; label: string };

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className={cn("flex w-full rounded-full bg-surface p-1", className)}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "flex-1 rounded-full px-4 py-2 text-sm transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              selected ? "bg-pill text-white" : "text-ink hover:bg-canvas",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
```

`src/components/ui/Logo.tsx` (hand-drawn mark: an open house outline with an "H" inside, after the brand book. Replace the paths with the Figma export when available):
```tsx
import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 56" fill="none" stroke="currentColor" strokeWidth={5} className={className} aria-hidden="true">
      <path d="M4 28 32 6l28 22" strokeLinejoin="miter" />
      <path d="M14 23v29h14v-9" />
      <path d="M23 26v12h18" />
      <path d="M41 26v26h9V23" />
    </svg>
  );
}

export function Logo({ withWordmark = false, className }: { withWordmark?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-primary", className)}>
      <LogoMark className="h-7 w-8" />
      {withWordmark ? <span className="text-lg font-bold text-ink">Space Rental</span> : <span className="sr-only">Space Rental</span>}
    </span>
  );
}
```

`src/components/ui/EmptyState.tsx`:
```tsx
import type { ReactNode } from "react";

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-16 text-center">
      {icon && (
        <div className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary [&>svg]:size-7" aria-hidden="true">
          {icon}
        </div>
      )}
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="text-sm text-muted">{body}</p>
      {action}
    </div>
  );
}
```

`src/components/ui/Avatar.tsx`:
```tsx
import { cn } from "@/lib/cn";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = Array.from(parts[0])[0];
  const last = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] : "";
  return (first + last).toUpperCase();
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex size-9 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary", className)}
    >
      {initials(name)}
    </span>
  );
}
```

`src/components/ui/PageContainer.tsx`:
```tsx
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function PageContainer({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 md:px-6", className)} {...props} />;
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm test:unit src/components/ui && pnpm typecheck`
Expected: PASS (13 tests). Typecheck is clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): add design tokens and core UI primitives"
```

---

### Task 4: Internationalization (en / rw / fr)

**Files:**
- Create: `messages/{en,rw,fr}.json`, `src/i18n/{routing,navigation,request,messages}.ts`, `src/i18n/messages.test.ts`, `src/global.d.ts`, `src/proxy.ts`, `src/lib/format.ts`, `src/lib/format.test.ts`, `src/test/render.tsx`, `src/app/[locale]/layout.tsx`, `src/app/[locale]/(main)/page.tsx` (temporary hello page, replaced in Task 10), `src/app/not-found.tsx`, `src/app/[locale]/[...rest]/page.tsx`
- Modify: `src/app/layout.tsx` (becomes a pass-through), `next.config.ts`
- Delete: `src/app/page.tsx`

**Interfaces:**
- Produces:
  - `routing` (locales `["en","rw","fr"]`, default `"en"`), `type AppLocale = "en"|"rw"|"fr"`, `toAppLocale(value: unknown): AppLocale`
  - `Link, redirect, usePathname, useRouter, getPathname` from `@/i18n/navigation`
  - `catalogs: Record<AppLocale, Messages>` from `@/i18n/messages`
  - `formatRWF(amount: number, locale?: string): string`
  - `renderWithIntl(ui, locale?)` from `@/test/render`
- Message namespaces used by later tasks (all keys below): `Metadata, Nav, Common, Home, Search, Onboarding, Auth (+Auth.errors), Profile (+Profile.errors), Empty, Errors, Emails, Locale`.

- [ ] **Step 1: Install next-intl**

```bash
pnpm add next-intl@4.14.9
```

- [ ] **Step 2: Write the message catalogs**

`messages/en.json`:
```json
{
  "Metadata": {
    "title": "Space Rental",
    "description": "Rent houses, lodges and apartments in Rwanda — by the hour, day, night or month."
  },
  "Nav": {
    "search": "Search",
    "favorites": "Favorites",
    "bookings": "Bookings",
    "chats": "Chats",
    "profile": "Profile",
    "login": "Log in",
    "signup": "Sign up",
    "language": "Language",
    "mainNav": "Main navigation",
    "back": "Back"
  },
  "Common": {
    "save": "Save",
    "saving": "Saving…",
    "saved": "Saved",
    "next": "Next",
    "skip": "Skip",
    "tryAgain": "Try again",
    "goHome": "Go to home"
  },
  "Home": {
    "titleTop": "Find",
    "titleBottom": "your new home",
    "modeLabel": "Rental type",
    "short": "Short-term",
    "long": "From 6 months",
    "location": "Location",
    "checkIn": "Check-in",
    "checkOut": "Check-out",
    "guests": "Number of guests",
    "search": "Search"
  },
  "Search": {
    "anywhere": "Anywhere in Rwanda",
    "emptyTitle": "No places here yet",
    "emptyBody": "Hosts are adding new homes every day. Check back soon."
  },
  "Onboarding": {
    "slide1": "Rent your perfect fit",
    "slide1Body": "Houses, lodges and apartments — for an hour, a night or a year.",
    "slide2": "Search by location",
    "slide2Body": "Find places in the neighborhood you love.",
    "slide3": "Save favorites",
    "slide3Body": "Keep the places you like and come back anytime.",
    "getStarted": "Get started",
    "progress": "Step {current} of {total}"
  },
  "Auth": {
    "signupTitle": "Sign up",
    "loginTitle": "Log in",
    "name": "Full name",
    "email": "Email",
    "password": "Password",
    "showPassword": "Show password",
    "hidePassword": "Hide password",
    "passwordHint": "At least 8 characters.",
    "createAccount": "Create account",
    "logIn": "Log in",
    "haveAccount": "Already have an account?",
    "noAccount": "No account?",
    "forgotPassword": "Forgot password?",
    "terms": "By continuing, you agree to our Terms of Service and confirm that you have read our Privacy Policy.",
    "checkEmailTitle": "Check your email",
    "checkEmailBody": "We sent a verification link to {email}. Open it to activate your account.",
    "checkEmailNoAddress": "We sent you a verification link. Open it to activate your account.",
    "resend": "Resend email",
    "resent": "Email sent again.",
    "verifiedTitle": "Email verified",
    "verifiedBody": "Your account is ready.",
    "continue": "Continue",
    "forgotTitle": "Reset your password",
    "forgotBody": "Enter your email and we'll send you a reset link.",
    "sendLink": "Send reset link",
    "linkSent": "If an account exists for that email, a reset link is on its way.",
    "resetTitle": "Choose a new password",
    "newPassword": "New password",
    "resetSubmit": "Update password",
    "resetDone": "Password updated. You can now log in.",
    "backToLogin": "Back to log in",
    "tagline": "Rent your perfect fit",
    "errors": {
      "emailTaken": "An account with this email already exists.",
      "invalidCredentials": "Wrong email or password.",
      "notVerified": "Please verify your email first. We just sent you a new link.",
      "passwordShort": "Password must be at least 8 characters.",
      "passwordLong": "Password is too long.",
      "passwordCommon": "This password is too common. Choose another one.",
      "invalidToken": "This link is invalid or has expired. Request a new one.",
      "tooMany": "Too many attempts. Wait a minute and try again.",
      "generic": "Something went wrong. Please try again.",
      "nameRequired": "Enter your name.",
      "nameTooLong": "Name is too long (80 characters max).",
      "emailInvalid": "Enter a valid email address."
    }
  },
  "Profile": {
    "title": "Profile",
    "name": "Full name",
    "email": "Email",
    "verified": "Verified",
    "notVerified": "Not verified",
    "phone": "Phone number",
    "phoneHint": "For example 0788 123 456",
    "language": "Language",
    "signOut": "Sign out",
    "errors": {
      "nameRequired": "Enter your name.",
      "nameTooLong": "Name is too long (80 characters max).",
      "phoneInvalid": "Enter a valid phone number.",
      "localeInvalid": "Choose a language from the list.",
      "generic": "Something went wrong. Please try again."
    }
  },
  "Empty": {
    "favoritesTitle": "No favorites yet",
    "favoritesBody": "Tap the heart on a place to save it here.",
    "bookingsTitle": "No bookings yet",
    "bookingsBody": "Your reservations and viewings will appear here.",
    "chatsTitle": "No messages yet",
    "chatsBody": "Conversations with hosts will appear here."
  },
  "Errors": {
    "title": "Something went wrong",
    "body": "We've been notified and are looking into it.",
    "notFoundTitle": "Page not found",
    "notFoundBody": "The page you're looking for doesn't exist."
  },
  "Emails": {
    "greeting": "Hello {name},",
    "verifySubject": "Confirm your email for Space Rental",
    "verifyBody": "Confirm your email address to finish creating your account.",
    "verifyButton": "Confirm email",
    "resetSubject": "Reset your Space Rental password",
    "resetBody": "We received a request to reset your password. This link expires in 1 hour.",
    "resetButton": "Reset password",
    "linkFallback": "If the button doesn't work, copy this link into your browser:",
    "ignore": "If you didn't request this, you can ignore this email.",
    "footer": "Space Rental · Kigali, Rwanda"
  },
  "Locale": {
    "en": "English",
    "rw": "Kinyarwanda",
    "fr": "Français"
  }
}
```

`messages/rw.json` (have a native speaker review before launch):
```json
{
  "Metadata": {
    "title": "Space Rental",
    "description": "Kodesha amazu, lodges n'amazu yo guturamo mu Rwanda — ku isaha, ku munsi, ku ijoro cyangwa ku kwezi."
  },
  "Nav": {
    "search": "Shakisha",
    "favorites": "Ibyo nkunda",
    "bookings": "Ibyo natumije",
    "chats": "Ubutumwa",
    "profile": "Konti",
    "login": "Injira",
    "signup": "Iyandikishe",
    "language": "Ururimi",
    "mainNav": "Ibice by'ingenzi",
    "back": "Subira inyuma"
  },
  "Common": {
    "save": "Bika",
    "saving": "Birabikwa…",
    "saved": "Byabitswe",
    "next": "Komeza",
    "skip": "Simbuka",
    "tryAgain": "Ongera ugerageze",
    "goHome": "Jya ahabanza"
  },
  "Home": {
    "titleTop": "Shaka",
    "titleBottom": "inzu yawe nshya",
    "modeLabel": "Ubwoko bw'ubukode",
    "short": "Igihe gito",
    "long": "Guhera ku mezi 6",
    "location": "Ahantu",
    "checkIn": "Kwinjira",
    "checkOut": "Gusohoka",
    "guests": "Umubare w'abashyitsi",
    "search": "Shakisha"
  },
  "Search": {
    "anywhere": "Ahantu hose mu Rwanda",
    "emptyTitle": "Nta nzu zirahaba",
    "emptyBody": "Ba nyir'amazu bongeramo amazu mashya buri munsi. Uzagaruke vuba."
  },
  "Onboarding": {
    "slide1": "Kodesha ikubereye",
    "slide1Body": "Amazu, lodges n'amazu yo guturamo — ku isaha, ijoro cyangwa umwaka.",
    "slide2": "Shakisha ukurikije ahantu",
    "slide2Body": "Shaka ahantu mu gace ukunda.",
    "slide3": "Bika ibyo ukunda",
    "slide3Body": "Bika ahantu ukunda, uzagaruke igihe cyose.",
    "getStarted": "Tangira",
    "progress": "Intambwe {current} kuri {total}"
  },
  "Auth": {
    "signupTitle": "Iyandikishe",
    "loginTitle": "Injira",
    "name": "Amazina yose",
    "email": "Imeyili",
    "password": "Ijambo ry'ibanga",
    "showPassword": "Erekana ijambo ry'ibanga",
    "hidePassword": "Hisha ijambo ry'ibanga",
    "passwordHint": "Nibura inyuguti 8.",
    "createAccount": "Fungura konti",
    "logIn": "Injira",
    "haveAccount": "Usanzwe ufite konti?",
    "noAccount": "Nta konti ufite?",
    "forgotPassword": "Wibagiwe ijambo ry'ibanga?",
    "terms": "Ukomeje, wemera Amabwiriza yacu kandi wemeza ko wasomye Politiki y'ibanga.",
    "checkEmailTitle": "Reba imeyili yawe",
    "checkEmailBody": "Twohereje umurongo wo kwemeza kuri {email}. Ufungure kugira ngo ukoreshe konti yawe.",
    "checkEmailNoAddress": "Twakoherereje umurongo wo kwemeza. Ufungure kugira ngo ukoreshe konti yawe.",
    "resend": "Ongera wohereze",
    "resent": "Imeyili yongeye koherezwa.",
    "verifiedTitle": "Imeyili yemejwe",
    "verifiedBody": "Konti yawe iteguye.",
    "continue": "Komeza",
    "forgotTitle": "Hindura ijambo ry'ibanga",
    "forgotBody": "Andika imeyili yawe tukoherereze umurongo wo kurihindura.",
    "sendLink": "Ohereza umurongo",
    "linkSent": "Niba hari konti ifite iyo meyili, umurongo uri mu nzira.",
    "resetTitle": "Hitamo ijambo ry'ibanga rishya",
    "newPassword": "Ijambo ry'ibanga rishya",
    "resetSubmit": "Hindura ijambo ry'ibanga",
    "resetDone": "Ijambo ry'ibanga ryahinduwe. Ubu ushobora kwinjira.",
    "backToLogin": "Subira ku kwinjira",
    "tagline": "Kodesha ikubereye",
    "errors": {
      "emailTaken": "Hari konti isanzwe ifite iyi meyili.",
      "invalidCredentials": "Imeyili cyangwa ijambo ry'ibanga si byo.",
      "notVerified": "Banza wemeze imeyili yawe. Tukoherereje undi murongo.",
      "passwordShort": "Ijambo ry'ibanga rigomba kuba nibura inyuguti 8.",
      "passwordLong": "Ijambo ry'ibanga ni rirerire cyane.",
      "passwordCommon": "Iri jambo ry'ibanga rirakoreshwa cyane. Hitamo irindi.",
      "invalidToken": "Uyu murongo ntukora cyangwa warangiye. Saba undi.",
      "tooMany": "Wagerageje inshuro nyinshi. Tegereza umunota wongere ugerageze.",
      "generic": "Hari ikitagenze neza. Ongera ugerageze.",
      "nameRequired": "Andika izina ryawe.",
      "nameTooLong": "Izina ni rirerire cyane (inyuguti 80 ntarengwa).",
      "emailInvalid": "Andika imeyili yemewe."
    }
  },
  "Profile": {
    "title": "Konti",
    "name": "Amazina yose",
    "email": "Imeyili",
    "verified": "Yemejwe",
    "notVerified": "Ntiyemejwe",
    "phone": "Nimero ya telefoni",
    "phoneHint": "Urugero 0788 123 456",
    "language": "Ururimi",
    "signOut": "Sohoka",
    "errors": {
      "nameRequired": "Andika izina ryawe.",
      "nameTooLong": "Izina ni rirerire cyane (inyuguti 80 ntarengwa).",
      "phoneInvalid": "Andika nimero ya telefoni yemewe.",
      "localeInvalid": "Hitamo ururimi ruri ku rutonde.",
      "generic": "Hari ikitagenze neza. Ongera ugerageze."
    }
  },
  "Empty": {
    "favoritesTitle": "Nta byo ukunda biraboneka",
    "favoritesBody": "Kanda ku mutima ku nzu kugira ngo uyibike hano.",
    "bookingsTitle": "Nta byo watumije biraboneka",
    "bookingsBody": "Ibyo wafashe n'amasura yawe bizagaragara hano.",
    "chatsTitle": "Nta butumwa buraboneka",
    "chatsBody": "Ibiganiro na ba nyir'amazu bizagaragara hano."
  },
  "Errors": {
    "title": "Hari ikitagenze neza",
    "body": "Twabimenyeshejwe kandi turimo kubikurikirana.",
    "notFoundTitle": "Paji ntiyabonetse",
    "notFoundBody": "Paji ushaka ntibaho."
  },
  "Emails": {
    "greeting": "Muraho {name},",
    "verifySubject": "Emeza imeyili yawe kuri Space Rental",
    "verifyBody": "Emeza aderesi ya imeyili yawe kugira ngo urangize gufungura konti.",
    "verifyButton": "Emeza imeyili",
    "resetSubject": "Hindura ijambo ry'ibanga rya Space Rental",
    "resetBody": "Twakiriye icyifuzo cyo guhindura ijambo ry'ibanga ryawe. Uyu murongo urangira mu isaha 1.",
    "resetButton": "Hindura ijambo ry'ibanga",
    "linkFallback": "Niba buto idakora, koporora uyu murongo uwushyire muri mushakisha yawe:",
    "ignore": "Niba atari wowe wabisabye, wirengagize iyi meyili.",
    "footer": "Space Rental · Kigali, Rwanda"
  },
  "Locale": {
    "en": "English",
    "rw": "Kinyarwanda",
    "fr": "Français"
  }
}
```

`messages/fr.json`:
```json
{
  "Metadata": {
    "title": "Space Rental",
    "description": "Louez maisons, lodges et appartements au Rwanda — à l'heure, à la journée, à la nuit ou au mois."
  },
  "Nav": {
    "search": "Rechercher",
    "favorites": "Favoris",
    "bookings": "Réservations",
    "chats": "Messages",
    "profile": "Profil",
    "login": "Se connecter",
    "signup": "S'inscrire",
    "language": "Langue",
    "mainNav": "Navigation principale",
    "back": "Retour"
  },
  "Common": {
    "save": "Enregistrer",
    "saving": "Enregistrement…",
    "saved": "Enregistré",
    "next": "Suivant",
    "skip": "Passer",
    "tryAgain": "Réessayer",
    "goHome": "Aller à l'accueil"
  },
  "Home": {
    "titleTop": "Trouvez",
    "titleBottom": "votre nouveau chez-vous",
    "modeLabel": "Type de location",
    "short": "Courte durée",
    "long": "À partir de 6 mois",
    "location": "Lieu",
    "checkIn": "Arrivée",
    "checkOut": "Départ",
    "guests": "Nombre de voyageurs",
    "search": "Rechercher"
  },
  "Search": {
    "anywhere": "Partout au Rwanda",
    "emptyTitle": "Aucun logement ici pour l'instant",
    "emptyBody": "Des hôtes ajoutent de nouveaux logements chaque jour. Revenez bientôt."
  },
  "Onboarding": {
    "slide1": "Louez ce qui vous convient",
    "slide1Body": "Maisons, lodges et appartements — pour une heure, une nuit ou une année.",
    "slide2": "Recherchez par lieu",
    "slide2Body": "Trouvez un logement dans le quartier que vous aimez.",
    "slide3": "Enregistrez vos favoris",
    "slide3Body": "Gardez les logements qui vous plaisent et revenez quand vous voulez.",
    "getStarted": "Commencer",
    "progress": "Étape {current} sur {total}"
  },
  "Auth": {
    "signupTitle": "Inscription",
    "loginTitle": "Connexion",
    "name": "Nom complet",
    "email": "E-mail",
    "password": "Mot de passe",
    "showPassword": "Afficher le mot de passe",
    "hidePassword": "Masquer le mot de passe",
    "passwordHint": "Au moins 8 caractères.",
    "createAccount": "Créer un compte",
    "logIn": "Se connecter",
    "haveAccount": "Vous avez déjà un compte ?",
    "noAccount": "Pas de compte ?",
    "forgotPassword": "Mot de passe oublié ?",
    "terms": "En continuant, vous acceptez nos Conditions d'utilisation et confirmez avoir lu notre Politique de confidentialité.",
    "checkEmailTitle": "Vérifiez votre e-mail",
    "checkEmailBody": "Nous avons envoyé un lien de vérification à {email}. Ouvrez-le pour activer votre compte.",
    "checkEmailNoAddress": "Nous vous avons envoyé un lien de vérification. Ouvrez-le pour activer votre compte.",
    "resend": "Renvoyer l'e-mail",
    "resent": "E-mail renvoyé.",
    "verifiedTitle": "E-mail vérifié",
    "verifiedBody": "Votre compte est prêt.",
    "continue": "Continuer",
    "forgotTitle": "Réinitialiser votre mot de passe",
    "forgotBody": "Saisissez votre e-mail et nous vous enverrons un lien de réinitialisation.",
    "sendLink": "Envoyer le lien",
    "linkSent": "Si un compte existe pour cet e-mail, un lien de réinitialisation est en route.",
    "resetTitle": "Choisissez un nouveau mot de passe",
    "newPassword": "Nouveau mot de passe",
    "resetSubmit": "Mettre à jour le mot de passe",
    "resetDone": "Mot de passe mis à jour. Vous pouvez maintenant vous connecter.",
    "backToLogin": "Retour à la connexion",
    "tagline": "Louez ce qui vous convient",
    "errors": {
      "emailTaken": "Un compte existe déjà avec cet e-mail.",
      "invalidCredentials": "E-mail ou mot de passe incorrect.",
      "notVerified": "Veuillez d'abord vérifier votre e-mail. Nous venons de vous envoyer un nouveau lien.",
      "passwordShort": "Le mot de passe doit contenir au moins 8 caractères.",
      "passwordLong": "Le mot de passe est trop long.",
      "passwordCommon": "Ce mot de passe est trop courant. Choisissez-en un autre.",
      "invalidToken": "Ce lien est invalide ou a expiré. Demandez-en un nouveau.",
      "tooMany": "Trop de tentatives. Attendez une minute et réessayez.",
      "generic": "Une erreur s'est produite. Veuillez réessayer.",
      "nameRequired": "Saisissez votre nom.",
      "nameTooLong": "Le nom est trop long (80 caractères maximum).",
      "emailInvalid": "Saisissez une adresse e-mail valide."
    }
  },
  "Profile": {
    "title": "Profil",
    "name": "Nom complet",
    "email": "E-mail",
    "verified": "Vérifié",
    "notVerified": "Non vérifié",
    "phone": "Numéro de téléphone",
    "phoneHint": "Par exemple 0788 123 456",
    "language": "Langue",
    "signOut": "Se déconnecter",
    "errors": {
      "nameRequired": "Saisissez votre nom.",
      "nameTooLong": "Le nom est trop long (80 caractères maximum).",
      "phoneInvalid": "Saisissez un numéro de téléphone valide.",
      "localeInvalid": "Choisissez une langue dans la liste.",
      "generic": "Une erreur s'est produite. Veuillez réessayer."
    }
  },
  "Empty": {
    "favoritesTitle": "Aucun favori pour l'instant",
    "favoritesBody": "Touchez le cœur d'un logement pour l'enregistrer ici.",
    "bookingsTitle": "Aucune réservation pour l'instant",
    "bookingsBody": "Vos réservations et visites apparaîtront ici.",
    "chatsTitle": "Aucun message pour l'instant",
    "chatsBody": "Vos conversations avec les hôtes apparaîtront ici."
  },
  "Errors": {
    "title": "Une erreur s'est produite",
    "body": "Nous avons été prévenus et nous examinons le problème.",
    "notFoundTitle": "Page introuvable",
    "notFoundBody": "La page que vous cherchez n'existe pas."
  },
  "Emails": {
    "greeting": "Bonjour {name},",
    "verifySubject": "Confirmez votre e-mail pour Space Rental",
    "verifyBody": "Confirmez votre adresse e-mail pour terminer la création de votre compte.",
    "verifyButton": "Confirmer l'e-mail",
    "resetSubject": "Réinitialisez votre mot de passe Space Rental",
    "resetBody": "Nous avons reçu une demande de réinitialisation de votre mot de passe. Ce lien expire dans 1 heure.",
    "resetButton": "Réinitialiser le mot de passe",
    "linkFallback": "Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :",
    "ignore": "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
    "footer": "Space Rental · Kigali, Rwanda"
  },
  "Locale": {
    "en": "English",
    "rw": "Kinyarwanda",
    "fr": "Français"
  }
}
```

- [ ] **Step 3: Write failing tests (catalog parity + RWF formatting)**

`src/i18n/messages.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { catalogs } from "./messages";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = `${prefix}${key}`;
    if (typeof value === "string") acc[path] = value;
    else Object.assign(acc, flatten(value, `${path}.`));
    return acc;
  }, {});
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const en = flatten(catalogs.en as unknown as Tree);

describe.each(["rw", "fr"] as const)("%s catalog", (locale) => {
  const other = flatten(catalogs[locale] as unknown as Tree);

  it("has exactly the same keys as en", () => {
    expect(Object.keys(other).sort()).toEqual(Object.keys(en).sort());
  });

  it("uses the same ICU placeholders as en for every key", () => {
    for (const key of Object.keys(en)) {
      expect(placeholders(other[key] ?? ""), key).toEqual(placeholders(en[key]));
    }
  });

  it("has no empty strings", () => {
    for (const [key, value] of Object.entries(other)) expect(value.trim(), key).not.toBe("");
  });
});
```

`src/lib/format.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { formatRWF } from "./format";

describe("formatRWF", () => {
  it("formats whole francs with English grouping", () => {
    expect(formatRWF(45000)).toBe("RWF 45,000");
    expect(formatRWF(0)).toBe("RWF 0");
  });

  it("uses French grouping for fr", () => {
    expect(formatRWF(1250000, "fr")).toMatch(/^RWF 1\s250\s000$/);
  });

  it("rejects fractional or non-finite amounts", () => {
    expect(() => formatRWF(10.5)).toThrow(RangeError);
    expect(() => formatRWF(Number.NaN)).toThrow(RangeError);
  });
});
```

- [ ] **Step 4: Run them and confirm they fail**

Run: `pnpm test:unit src/i18n src/lib/format.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 5: Implement the i18n modules and formatter**

`src/i18n/routing.ts`:
```ts
import { hasLocale } from "next-intl";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "rw", "fr"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];

export function toAppLocale(value: unknown): AppLocale {
  return typeof value === "string" && hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}
```

`src/i18n/navigation.ts`:
```ts
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
```

`src/i18n/messages.ts`:
```ts
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import rw from "../../messages/rw.json";
import type { AppLocale } from "./routing";

export type Messages = typeof en;

export const catalogs: Record<AppLocale, Messages> = { en, rw, fr };
```

`src/i18n/request.ts`:
```ts
import { getRequestConfig } from "next-intl/server";
import { catalogs } from "./messages";
import { toAppLocale } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = toAppLocale(await requestLocale);
  return { locale, messages: catalogs[locale], timeZone: "Africa/Kigali" };
});
```

`src/global.d.ts`:
```ts
import type { Messages } from "@/i18n/messages";
import type { AppLocale } from "@/i18n/routing";

declare module "next-intl" {
  interface AppConfig {
    Locale: AppLocale;
    Messages: Messages;
  }
}
```

`src/proxy.ts` (Next 16 renamed `middleware.ts` to `proxy.ts`):
```ts
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
```

`src/lib/format.ts`:
```ts
export function formatRWF(amount: number, locale: string = "en"): string {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`RWF amounts must be whole numbers, got ${amount}`);
  }
  return `RWF ${new Intl.NumberFormat(locale).format(amount)}`;
}
```

`src/test/render.tsx`:
```tsx
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { catalogs } from "@/i18n/messages";
import type { AppLocale } from "@/i18n/routing";

export function renderWithIntl(ui: ReactElement, locale: AppLocale = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="Africa/Kigali">
      {ui}
    </NextIntlClientProvider>,
  );
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `pnpm test:unit src/i18n src/lib/format.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 7: Wire up the localized layouts**

Replace `src/app/layout.tsx` (a pass-through, so `[locale]/layout.tsx` owns `<html>`):
```tsx
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
```

`src/app/not-found.tsx` (for requests outside any locale):
```tsx
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 32 }}>
        <h1>Page not found</h1>
        <a href="/">Go to home</a>
      </body>
    </html>
  );
}
```

`src/app/[locale]/layout.tsx`:
```tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { routing } from "@/i18n/routing";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const viewport: Viewport = { themeColor: "#0057b8" };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: { default: t("title"), template: `%s · ${t("title")}` }, description: t("description") };
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} className={inter.variable}>
      <body className="min-h-dvh bg-canvas font-sans text-ink antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
```

`src/app/[locale]/[...rest]/page.tsx`:
```tsx
import { notFound } from "next/navigation";

export default function CatchAll() {
  notFound();
}
```

Delete `src/app/page.tsx` and create a temporary `src/app/[locale]/(main)/page.tsx` (Task 10 replaces it):
```tsx
import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("Home");
  return (
    <h1 className="p-6 text-3xl">
      {t("titleTop")} {t("titleBottom")}
    </h1>
  );
}
```

Replace `next.config.ts` (Task 11 adds the security headers):
```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  poweredByHeader: false,
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
```

- [ ] **Step 8: Verify in the browser**

Run: `pnpm build && pnpm start`
Then check:
- `curl -sI http://localhost:3000/` returns a redirect to `/en`.
- `curl -s http://localhost:3000/fr | grep -o "Trouvez votre nouveau chez-vous"` prints the match.
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/en/nope` prints `404`.

Stop the server afterwards.

- [ ] **Step 9: Commit**

```bash
pnpm lint && pnpm typecheck && pnpm test:unit
git add -A
git commit -m "feat(i18n): add en/rw/fr locales with typed catalogs and RWF formatting"
```

---
### Task 5: Environment config, logger and Mailer adapter

**Files:**
- Create: `src/lib/env.ts`, `src/lib/env.test.ts`, `src/lib/logger.ts`, `src/lib/mailer/{types,memory,file,resend,index}.ts`, `src/lib/mailer/mailer.test.ts`

**Interfaces:**
- Produces:
  - `getEnv(): Env` (cached) and `parseEnv(source): Env`, where `Env` has the fields `DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, MAIL_DRIVER ("resend"|"file"|"memory"), MAIL_FROM, MAIL_OUTBOX_DIR, RESEND_API_KEY?, RATE_LIMIT_ENABLED (boolean), LOG_LEVEL, SENTRY_DSN?`
  - `logger` (pino)
  - `interface MailMessage { to; subject; html; text }` and `interface Mailer { send(m): Promise<void> }`
  - `MemoryMailer` (`.sent: MailMessage[]`, `.clear()`), `FileMailer(dir)`, `ResendMailer(apiKey, from)`
  - `getMailer(): Mailer`, `setMailerForTests(m?: Mailer)`

- [ ] **Step 1: Install**

```bash
pnpm add pino@10.4.0 resend@6.32.1
pnpm add -D pino-pretty@13.2.0
```

- [ ] **Step 2: Write failing tests**

`src/lib/env.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
};

describe("parseEnv", () => {
  it("applies safe defaults", () => {
    const env = parseEnv(base);
    expect(env.MAIL_DRIVER).toBe("file");
    expect(env.RATE_LIMIT_ENABLED).toBe(true);
    expect(env.MAIL_OUTBOX_DIR).toBe(".mail-outbox");
  });

  it("parses RATE_LIMIT_ENABLED=false", () => {
    expect(parseEnv({ ...base, RATE_LIMIT_ENABLED: "false" }).RATE_LIMIT_ENABLED).toBe(false);
  });

  it("rejects a short auth secret", () => {
    expect(() => parseEnv({ ...base, BETTER_AUTH_SECRET: "short" })).toThrow();
  });

  it("requires RESEND_API_KEY when MAIL_DRIVER=resend", () => {
    expect(() => parseEnv({ ...base, MAIL_DRIVER: "resend", RESEND_API_KEY: "" })).toThrow(/RESEND_API_KEY/);
    expect(parseEnv({ ...base, MAIL_DRIVER: "resend", RESEND_API_KEY: "re_123" }).MAIL_DRIVER).toBe("resend");
  });
});
```

`src/lib/mailer/mailer.test.ts`:
```ts
// @vitest-environment node
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileMailer } from "./file";
import { MemoryMailer } from "./memory";

const message = { to: "a@example.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi" };

describe("MemoryMailer", () => {
  it("records sent messages and can be cleared", async () => {
    const mailer = new MemoryMailer();
    await mailer.send(message);
    expect(mailer.sent).toEqual([message]);
    mailer.clear();
    expect(mailer.sent).toEqual([]);
  });
});

describe("FileMailer", () => {
  let dir = "";
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("writes one JSON file per message, creating the folder if needed", async () => {
    dir = path.join(await mkdtemp(path.join(os.tmpdir(), "mail-")), "nested");
    const mailer = new FileMailer(dir);
    await mailer.send(message);
    await mailer.send({ ...message, subject: "Second" });
    const files = await readdir(dir);
    expect(files).toHaveLength(2);
    const parsed = JSON.parse(await readFile(path.join(dir, files.sort()[0]), "utf8"));
    expect(parsed).toMatchObject(message);
    expect(typeof parsed.sentAt).toBe("string");
  });
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `pnpm test:unit src/lib/env.test.ts src/lib/mailer`
Expected: FAIL (modules not found).

- [ ] **Step 4: Implement**

`src/lib/env.ts`:
```ts
import { z } from "zod";

const schema = z
  .object({
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    MAIL_DRIVER: z.enum(["resend", "file", "memory"]).default("file"),
    MAIL_FROM: z.string().min(3).default("Space Rental <no-reply@spacerental.rw>"),
    MAIL_OUTBOX_DIR: z.string().min(1).default(".mail-outbox"),
    RESEND_API_KEY: z.string().optional(),
    RATE_LIMIT_ENABLED: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    SENTRY_DSN: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.MAIL_DRIVER === "resend" && !env.RESEND_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "RESEND_API_KEY is required when MAIL_DRIVER=resend" });
    }
  });

export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  return schema.parse(source);
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
```

`src/lib/logger.ts`:
```ts
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { app: "space-rental" },
  redact: {
    paths: ["password", "*.password", "newPassword", "*.newPassword", "token", "*.token", "headers.cookie", "headers.authorization"],
    censor: "[redacted]",
  },
});
```

`src/lib/mailer/types.ts`:
```ts
export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}
```

`src/lib/mailer/memory.ts`:
```ts
import type { MailMessage, Mailer } from "./types";

export class MemoryMailer implements Mailer {
  readonly sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }

  clear(): void {
    this.sent.length = 0;
  }
}
```

`src/lib/mailer/file.ts`:
```ts
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MailMessage, Mailer } from "./types";

export class FileMailer implements Mailer {
  constructor(private readonly dir: string) {}

  async send(message: MailMessage): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const file = path.join(this.dir, `${Date.now()}-${randomUUID()}.json`);
    await writeFile(file, JSON.stringify({ ...message, sentAt: new Date().toISOString() }, null, 2));
  }
}
```

`src/lib/mailer/resend.ts`:
```ts
import { Resend } from "resend";
import type { MailMessage, Mailer } from "./types";

export class ResendMailer implements Mailer {
  private readonly client: Resend;

  constructor(apiKey: string, private readonly from: string) {
    this.client = new Resend(apiKey);
  }

  async send(message: MailMessage): Promise<void> {
    const { error } = await this.client.emails.send({ from: this.from, ...message });
    if (error) throw new Error(`Resend failed: ${error.message}`);
  }
}
```

`src/lib/mailer/index.ts`:
```ts
import { getEnv } from "@/lib/env";
import { FileMailer } from "./file";
import { MemoryMailer } from "./memory";
import { ResendMailer } from "./resend";
import type { Mailer } from "./types";

export type { MailMessage, Mailer } from "./types";
export { FileMailer, MemoryMailer, ResendMailer };

let instance: Mailer | undefined;

export function getMailer(): Mailer {
  if (instance) return instance;
  const env = getEnv();
  if (env.MAIL_DRIVER === "resend") instance = new ResendMailer(env.RESEND_API_KEY!, env.MAIL_FROM);
  else if (env.MAIL_DRIVER === "memory") instance = new MemoryMailer();
  else instance = new FileMailer(env.MAIL_OUTBOX_DIR);
  return instance;
}

export function setMailerForTests(mailer: Mailer | undefined): void {
  instance = mailer;
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm test:unit src/lib/env.test.ts src/lib/mailer`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(lib): add validated env, logger and Mailer adapter"
```

---

### Task 6: Auth server (Better Auth, passwords, emails, sessions)

**Files:**
- Create:
  - `src/features/auth/{constants,common-passwords,password,schemas,errors,emails}.ts` and their tests `src/features/auth/{password,schemas,errors,emails}.test.ts`
  - `src/lib/{safe-redirect,zod-errors}.ts`, `src/lib/safe-redirect.test.ts`
  - `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/lib/session.ts`
  - `src/app/api/auth/[...all]/route.ts`
  - `src/features/auth/auth.int.test.ts`
- Modify: `next.config.ts` (server externals)

**Interfaces:**
- Consumes: `db`, `getEnv`, `getMailer`/`setMailerForTests`/`MemoryMailer`, `logger`, `catalogs`, `toAppLocale`, `resetDb`.
- Produces:
  - `PASSWORD_MIN = 8`, `PASSWORD_MAX = 128`
  - `hashPassword(p): Promise<string>`, `verifyPassword(hash, p): Promise<boolean>`, `isCommonPassword(p): boolean`
  - `emailSchema`, `signupSchema`, `loginSchema`, `forgotPasswordSchema`, `resetPasswordSchema` (zod; their messages are `AuthErrorKey` values)
  - `type AuthErrorKey`, `authErrorKey(err?: { code?: string|null; status?: number|null } | null): AuthErrorKey`, `fieldForAuthError(key): "name"|"email"|"password"|"form"`
  - `buildVerificationEmail({to,name,url,locale?})` and `buildPasswordResetEmail({to,name,url,locale?})`, both returning `MailMessage`, plus `escapeHtml(s)`
  - `safeNextPath(input: unknown, fallback = "/"): string`
  - `firstErrors(error: ZodError): Record<string, string>`
  - `auth` (Better Auth instance), `authClient` (React client)
  - `getSession()`, `getCurrentUser(): Promise<SessionUser | null>`, `requireUser(nextPath: string): Promise<SessionUser>`
- Session user fields: `id, name, email, emailVerified, phone, locale, role, isHost`.

- [ ] **Step 1: Install**

```bash
pnpm add better-auth@1.7.7 @node-rs/argon2@2.2.2
```

In `next.config.ts`, add `serverExternalPackages: ["@node-rs/argon2"],` inside `nextConfig`.

- [ ] **Step 2: Write failing unit tests**

`src/features/auth/password.test.ts`:
```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hashPassword, isCommonPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("produces an argon2id hash that verifies only the right password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hash, "correct horse battery")).toBe(true);
    expect(await verifyPassword(hash, "wrong horse battery")).toBe(false);
  });
});

describe("isCommonPassword", () => {
  it("flags common passwords regardless of case and surrounding spaces", () => {
    expect(isCommonPassword("password123")).toBe(true);
    expect(isCommonPassword("  PASSWORD123 ")).toBe(true);
    expect(isCommonPassword("kigali123")).toBe(true);
  });
  it("accepts uncommon passwords", () => {
    expect(isCommonPassword("blue-lake-umuganda-42")).toBe(false);
  });
});
```

`src/features/auth/schemas.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { firstErrors } from "@/lib/zod-errors";
import { loginSchema, signupSchema } from "./schemas";

describe("signupSchema", () => {
  it("trims the name and lowercases the email", () => {
    const parsed = signupSchema.parse({ name: "  Alona ", email: " Alona@Example.COM ", password: "longenough" });
    expect(parsed).toEqual({ name: "Alona", email: "alona@example.com", password: "longenough" });
  });

  it("reports one message key per field", () => {
    const result = signupSchema.safeParse({ name: " ", email: "nope", password: "short" });
    expect(result.success).toBe(false);
    expect(firstErrors(result.error!)).toEqual({ name: "nameRequired", email: "emailInvalid", password: "passwordShort" });
  });

  it("rejects names over 80 characters and passwords over 128", () => {
    const result = signupSchema.safeParse({ name: "a".repeat(81), email: "a@b.co", password: "x".repeat(129) });
    expect(firstErrors(result.error!)).toEqual({ name: "nameTooLong", password: "passwordLong" });
  });
});

describe("loginSchema", () => {
  it("requires a password", () => {
    const result = loginSchema.safeParse({ email: "a@b.co", password: "" });
    expect(firstErrors(result.error!)).toEqual({ password: "invalidCredentials" });
  });
});
```

`src/features/auth/errors.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { authErrorKey, fieldForAuthError } from "./errors";

describe("authErrorKey", () => {
  it.each([
    [{ code: "USER_ALREADY_EXISTS" }, "emailTaken"],
    [{ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" }, "emailTaken"],
    [{ code: "INVALID_EMAIL_OR_PASSWORD" }, "invalidCredentials"],
    [{ code: "EMAIL_NOT_VERIFIED" }, "notVerified"],
    [{ code: "PASSWORD_TOO_SHORT" }, "passwordShort"],
    [{ code: "PASSWORD_TOO_LONG" }, "passwordLong"],
    [{ code: "PASSWORD_TOO_COMMON" }, "passwordCommon"],
    [{ code: "INVALID_TOKEN" }, "invalidToken"],
    [{ code: "TOKEN_EXPIRED" }, "invalidToken"],
    [{ status: 429 }, "tooMany"],
    [{ code: "SOMETHING_NEW" }, "generic"],
    [null, "generic"],
  ] as const)("%j → %s", (input, expected) => {
    expect(authErrorKey(input)).toBe(expected);
  });
});

describe("fieldForAuthError", () => {
  it("routes errors to the field they belong to", () => {
    expect(fieldForAuthError("passwordCommon")).toBe("password");
    expect(fieldForAuthError("emailTaken")).toBe("email");
    expect(fieldForAuthError("nameTooLong")).toBe("name");
    expect(fieldForAuthError("tooMany")).toBe("form");
  });
});
```

`src/features/auth/emails.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildPasswordResetEmail, buildVerificationEmail } from "./emails";

describe("auth emails", () => {
  const url = "https://app.test/api/auth/verify-email?token=abc&callbackURL=%2Fen%2Fverified";

  it("builds a verification email in the user's locale", () => {
    const mail = buildVerificationEmail({ to: "a@example.com", name: "Alona", url, locale: "fr" });
    expect(mail.to).toBe("a@example.com");
    expect(mail.subject).toBe("Confirmez votre e-mail pour Space Rental");
    expect(mail.text).toContain("Bonjour Alona,");
    expect(mail.text).toContain(url);
  });

  it("falls back to English for unknown or missing locales", () => {
    expect(buildVerificationEmail({ to: "a@x.co", name: "A", url, locale: "de" }).subject).toBe("Confirm your email for Space Rental");
    expect(buildPasswordResetEmail({ to: "a@x.co", name: "A", url }).subject).toBe("Reset your Space Rental password");
  });

  it("escapes user-controlled text and URLs in HTML", () => {
    const mail = buildVerificationEmail({ to: "a@x.co", name: '<img src=x onerror="alert(1)">', url, locale: "en" });
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(mail.html).toContain('href="https://app.test/api/auth/verify-email?token=abc&amp;callbackURL=%2Fen%2Fverified"');
  });
});
```

`src/lib/safe-redirect.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it.each(["/profile", "/search?mode=long&location=Kigali", "/bookings/abc"])("keeps same-site path %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "profile",
    "",
    "/ok\nSet-Cookie: x",
    undefined,
    null,
    42,
    ["/profile"],
  ])("falls back for %j", (value) => {
    expect(safeNextPath(value)).toBe("/");
  });

  it("supports a custom fallback", () => {
    expect(safeNextPath("//evil.com", "/profile")).toBe("/profile");
  });
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `pnpm test:unit src/features/auth src/lib/safe-redirect.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 4: Implement the pure modules**

`src/features/auth/constants.ts` (no server imports, so it is safe for client bundles):
```ts
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
```

`src/features/auth/common-passwords.ts`:
```ts
// Lowercased. Only entries of 8+ characters matter (shorter ones fail the length rule).
// Extend with local terms as abuse patterns appear.
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  "password", "password1", "password12", "password123", "passw0rd", "mypassword", "changeme",
  "12345678", "123456789", "1234567890", "123123123", "987654321", "12341234", "11223344",
  "11111111", "00000000", "22222222", "33333333", "44444444", "55555555", "66666666",
  "77777777", "88888888", "99999999", "999999999", "12121212", "11112222",
  "qwertyuiop", "qwerty123", "qwerty12", "qwertyui", "1q2w3e4r", "q1w2e3r4", "1qaz2wsx",
  "zaq12wsx", "asdfghjk", "asdf1234", "zxcvbnm1", "1234qwer", "123qweasd", "aa123456",
  "a1234567", "abc12345", "iloveyou", "iloveyou1", "loveyou1", "sunshine", "princess",
  "football", "football1", "baseball", "welcome1", "welcome123", "admin123", "letmein1",
  "trustno1", "superman", "michael1", "computer", "computer1", "whatever", "starwars",
  "dragon12", "master12", "monkey123", "shadow12", "jesus123", "hello123", "test1234",
  "pass1234", "internet", "samsung1", "google123", "facebook", "nokia123", "manchester",
  "liverpool", "arsenal1", "chelsea1", "barcelona", "realmadrid",
  "rwanda123", "rwanda2024", "rwanda2025", "rwanda2026", "kigali123", "kigali2026",
  "spacerental", "space123",
]);
```

`src/features/auth/password.ts`:
```ts
import { hash, verify } from "@node-rs/argon2";
import { COMMON_PASSWORDS } from "./common-passwords";

// OWASP-recommended argon2id parameters (19 MiB, 2 iterations, 1 lane). Argon2id is the library default.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.trim().toLowerCase());
}
```

`src/lib/zod-errors.ts`:
```ts
import type { ZodError } from "zod";

/** First message per top-level field, e.g. { email: "emailInvalid" }. */
export function firstErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
```

`src/features/auth/schemas.ts`:
```ts
import { z } from "zod";
import { PASSWORD_MAX, PASSWORD_MIN } from "./constants";

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("emailInvalid"));
const newPassword = z.string().min(PASSWORD_MIN, "passwordShort").max(PASSWORD_MAX, "passwordLong");

export const signupSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(80, "nameTooLong"),
  email: emailSchema,
  password: newPassword,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "invalidCredentials"),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({ password: newPassword });
```

`src/features/auth/errors.ts`:
```ts
import type { Messages } from "@/i18n/messages";

export type AuthErrorKey = keyof Messages["Auth"]["errors"];

export function authErrorKey(error?: { code?: string | null; status?: number | null } | null): AuthErrorKey {
  if (!error) return "generic";
  if (error.status === 429) return "tooMany";
  const code = error.code ?? "";
  if (code.startsWith("USER_ALREADY_EXISTS")) return "emailTaken";
  if (code === "INVALID_EMAIL_OR_PASSWORD" || code === "INVALID_PASSWORD" || code === "INVALID_EMAIL") return "invalidCredentials";
  if (code === "EMAIL_NOT_VERIFIED") return "notVerified";
  if (code === "PASSWORD_TOO_SHORT") return "passwordShort";
  if (code === "PASSWORD_TOO_LONG") return "passwordLong";
  if (code === "PASSWORD_TOO_COMMON") return "passwordCommon";
  if (code === "INVALID_TOKEN" || code === "TOKEN_EXPIRED") return "invalidToken";
  return "generic";
}

export function fieldForAuthError(key: AuthErrorKey): "name" | "email" | "password" | "form" {
  if (key.startsWith("password")) return "password";
  if (key === "emailTaken" || key === "emailInvalid") return "email";
  if (key.startsWith("name")) return "name";
  return "form";
}
```

`src/features/auth/emails.ts`:
```ts
import { createTranslator } from "next-intl";
import { catalogs } from "@/i18n/messages";
import { toAppLocale } from "@/i18n/routing";
import type { MailMessage } from "@/lib/mailer/types";

type EmailInput = { to: string; name: string; url: string; locale?: string | null };

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function render(kind: "verify" | "reset", { to, name, url, locale }: EmailInput): MailMessage {
  const lang = toAppLocale(locale);
  const t = createTranslator({ locale: lang, messages: catalogs[lang], namespace: "Emails" });
  const subject = kind === "verify" ? t("verifySubject") : t("resetSubject");
  const body = kind === "verify" ? t("verifyBody") : t("resetBody");
  const button = kind === "verify" ? t("verifyButton") : t("resetButton");
  const greeting = t("greeting", { name });
  const href = escapeHtml(url);

  const html = `<!doctype html>
<html lang="${lang}"><body style="margin:0;background:#f2f2f2;font-family:Inter,Arial,sans-serif;color:#1a1c1e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td style="font-size:20px;font-weight:700;color:#0057b8;padding-bottom:24px">Space Rental</td></tr>
<tr><td style="font-size:16px;padding-bottom:8px">${escapeHtml(greeting)}</td></tr>
<tr><td style="font-size:16px;line-height:1.5;padding-bottom:24px">${escapeHtml(body)}</td></tr>
<tr><td style="padding-bottom:24px"><a href="${href}" style="display:inline-block;background:#0057b8;color:#ffffff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:999px">${escapeHtml(button)}</a></td></tr>
<tr><td style="font-size:13px;color:#6b7075;padding-bottom:8px">${escapeHtml(t("linkFallback"))}</td></tr>
<tr><td style="font-size:13px;word-break:break-all;padding-bottom:24px"><a href="${href}" style="color:#0057b8">${href}</a></td></tr>
<tr><td style="font-size:13px;color:#6b7075">${escapeHtml(t("ignore"))}</td></tr>
</table>
<p style="font-size:12px;color:#6b7075">${escapeHtml(t("footer"))}</p>
</td></tr></table></body></html>`;

  const text = [greeting, body, url, t("ignore"), t("footer")].join("\n\n");
  return { to, subject, html, text };
}

export function buildVerificationEmail(input: EmailInput): MailMessage {
  return render("verify", input);
}

export function buildPasswordResetEmail(input: EmailInput): MailMessage {
  return render("reset", input);
}
```

`src/lib/safe-redirect.ts`:
```ts
/** Accept only same-site absolute paths ("/x"); anything else returns the fallback. */
export function safeNextPath(input: unknown, fallback = "/"): string {
  if (typeof input !== "string") return fallback;
  if (!input.startsWith("/") || input.startsWith("//") || input.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(input)) return fallback;
  return input;
}
```

- [ ] **Step 5: Run the unit tests and confirm they pass**

Run: `pnpm test:unit src/features/auth src/lib/safe-redirect.test.ts`
Expected: PASS (all tests in the four auth test files and the safe-redirect file).

- [ ] **Step 6: Better Auth server, route, client and session helpers**

`src/lib/auth.ts`:
```ts
import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/features/auth/constants";
import { buildPasswordResetEmail, buildVerificationEmail } from "@/features/auth/emails";
import { hashPassword, isCommonPassword, verifyPassword } from "@/features/auth/password";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getMailer, type MailMessage } from "@/lib/mailer";

const env = getEnv();

// Fire-and-forget: a mail outage must not fail sign-up, and not awaiting avoids
// leaking account existence through response timing.
function sendInBackground(message: MailMessage, kind: string) {
  void getMailer()
    .send(message)
    .catch((err: unknown) => logger.error({ err, kind }, "auth email failed"));
}

const localeOf = (user: unknown) => (user as { locale?: string }).locale;

export const auth = betterAuth({
  appName: "Space Rental",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  user: {
    additionalFields: {
      phone: { type: "string", required: false, input: false },
      locale: { type: "string", required: false, defaultValue: "en", input: true },
      role: { type: "string", required: false, defaultValue: "USER", input: false },
      isHost: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: PASSWORD_MIN,
    maxPasswordLength: PASSWORD_MAX,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    password: {
      hash: hashPassword,
      verify: ({ hash, password }) => verifyPassword(hash, password),
    },
    sendResetPassword: async ({ user, url }) => {
      sendInBackground(buildPasswordResetEmail({ to: user.email, name: user.name, url, locale: localeOf(user) }), "reset");
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      sendInBackground(buildVerificationEmail({ to: user.email, name: user.name, url, locale: localeOf(user) }), "verify");
    },
  },
  rateLimit: {
    enabled: env.RATE_LIMIT_ENABLED,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
      "/send-verification-email": { window: 60, max: 3 },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const candidate =
        ctx.path === "/sign-up/email" ? ctx.body?.password : ctx.path === "/reset-password" ? ctx.body?.newPassword : undefined;
      if (typeof candidate === "string" && isCommonPassword(candidate)) {
        throw new APIError("BAD_REQUEST", { code: "PASSWORD_TOO_COMMON", message: "Password is too common" });
      }
    }),
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
export type SessionUser = AuthSession["user"];
```

`src/app/api/auth/[...all]/route.ts`:
```ts
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth);
```

`src/lib/auth-client.ts`:
```ts
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});
```

`src/lib/session.ts`:
```ts
import "server-only";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { cache } from "react";
import { redirect } from "@/i18n/navigation";
import { auth, type SessionUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-redirect";

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await getSession())?.user ?? null;
}

/** Returns the signed-in user or redirects to /login?next=<nextPath>. `nextPath` excludes the locale. */
export async function requireUser(nextPath: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (user) return user;
  const locale = await getLocale();
  return redirect({ href: { pathname: "/login", query: { next: safeNextPath(nextPath) } }, locale });
}
```

- [ ] **Step 7: Write the failing integration tests**

`src/features/auth/auth.int.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authErrorKey } from "@/features/auth/errors";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { MemoryMailer, setMailerForTests, type Mailer } from "@/lib/mailer";
import { resetDb } from "@/test/db";

const BASE = process.env.BETTER_AUTH_URL!;
const PASSWORD = "umuganda-blue-lake-42";
let mailer: MemoryMailer;

async function errorOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    const err = e as { body?: { code?: string }; statusCode?: number };
    return { code: err.body?.code, status: err.statusCode };
  }
  throw new Error("expected the call to fail");
}

async function lastMailTo(email: string) {
  await vi.waitFor(() => expect(mailer.sent.some((m) => m.to === email)).toBe(true));
  return mailer.sent.filter((m) => m.to === email).at(-1)!;
}

const linkIn = (text: string) => text.match(/https?:\/\/\S+/)![0];

async function signUp(email: string, locale = "en", password = PASSWORD) {
  return auth.api.signUpEmail({ body: { name: "Alona", email, password, locale, callbackURL: `/${locale}/verified` } });
}

async function signUpAndVerify(email: string) {
  await signUp(email);
  const mail = await lastMailTo(email);
  await auth.handler(new Request(linkIn(mail.text)));
}

beforeEach(async () => {
  await resetDb();
  mailer = new MemoryMailer();
  setMailerForTests(mailer);
});

describe("sign up", () => {
  it("creates an unverified user with defaults and the chosen locale", async () => {
    await signUp("new@example.com", "rw");
    const user = await db.user.findUniqueOrThrow({ where: { email: "new@example.com" } });
    expect(user).toMatchObject({ emailVerified: false, locale: "rw", role: "USER", isHost: false });
  });

  it("stores an argon2id hash, never the plain password", async () => {
    await signUp("hash@example.com");
    const account = await db.account.findFirstOrThrow({ where: { user: { email: "hash@example.com" } } });
    expect(account.password?.startsWith("$argon2id$")).toBe(true);
    expect(account.password).not.toContain(PASSWORD);
  });

  it("sends the verification email in the user's language with a link to this app", async () => {
    await signUp("rw@example.com", "rw");
    const mail = await lastMailTo("rw@example.com");
    expect(mail.subject).toBe("Emeza imeyili yawe kuri Space Rental");
    expect(linkIn(mail.text).startsWith(`${BASE}/api/auth/verify-email?token=`)).toBe(true);
  });

  it("rejects common passwords", async () => {
    expect(authErrorKey(await errorOf(signUp("common@example.com", "en", "password123")))).toBe("passwordCommon");
    expect(await db.user.count()).toBe(0);
  });

  it("never creates a second account for the same email", async () => {
    await signUp("dupe@example.com");
    await signUp("dupe@example.com").catch(() => undefined);
    expect(await db.user.count({ where: { email: "dupe@example.com" } })).toBe(1);
  });

  it("still succeeds when the email provider is down", async () => {
    const failing: Mailer = { send: () => Promise.reject(new Error("SMTP down")) };
    setMailerForTests(failing);
    await expect(signUp("outage@example.com")).resolves.toBeTruthy();
    expect(await db.user.count({ where: { email: "outage@example.com" } })).toBe(1);
  });
});

describe("sign in", () => {
  it("is refused until the email is verified", async () => {
    await signUp("unverified@example.com");
    const error = await errorOf(auth.api.signInEmail({ body: { email: "unverified@example.com", password: PASSWORD } }));
    expect(authErrorKey(error)).toBe("notVerified");
  });

  it("works after following the verification link", async () => {
    await signUpAndVerify("ok@example.com");
    expect((await db.user.findUniqueOrThrow({ where: { email: "ok@example.com" } })).emailVerified).toBe(true);
    const result = await auth.api.signInEmail({ body: { email: "ok@example.com", password: PASSWORD } });
    expect(result.user.email).toBe("ok@example.com");
  });

  it("rejects a wrong password", async () => {
    await signUpAndVerify("wrong@example.com");
    const error = await errorOf(auth.api.signInEmail({ body: { email: "wrong@example.com", password: "not-the-password" } }));
    expect(authErrorKey(error)).toBe("invalidCredentials");
  });

  it("rate-limits repeated attempts from one IP (6th within a minute gets 429)", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await auth.handler(
        new Request(`${BASE}/api/auth/sign-in/email`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: BASE, "x-forwarded-for": "203.0.113.7" },
          body: JSON.stringify({ email: "nobody@example.com", password: "whatever-123" }),
        }),
      );
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5).every((s) => s !== 429)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});

describe("password reset", () => {
  it("replaces the password using the emailed token", async () => {
    await signUpAndVerify("reset@example.com");
    mailer.clear();
    await auth.api.requestPasswordReset({ body: { email: "reset@example.com", redirectTo: "/en/reset-password" } });
    const mail = await lastMailTo("reset@example.com");
    expect(mail.subject).toBe("Reset your Space Rental password");
    const token = new URL(linkIn(mail.text)).pathname.split("/").at(-1)!;

    await auth.api.resetPassword({ body: { token, newPassword: "new-river-kivu-77" } });

    await expect(auth.api.signInEmail({ body: { email: "reset@example.com", password: "new-river-kivu-77" } })).resolves.toBeTruthy();
    expect(authErrorKey(await errorOf(auth.api.signInEmail({ body: { email: "reset@example.com", password: PASSWORD } })))).toBe(
      "invalidCredentials",
    );
  });

  it("rejects common new passwords", async () => {
    await signUpAndVerify("reset2@example.com");
    mailer.clear();
    await auth.api.requestPasswordReset({ body: { email: "reset2@example.com", redirectTo: "/en/reset-password" } });
    const token = new URL(linkIn((await lastMailTo("reset2@example.com")).text)).pathname.split("/").at(-1)!;
    expect(authErrorKey(await errorOf(auth.api.resetPassword({ body: { token, newPassword: "password123" } })))).toBe("passwordCommon");
  });

  it("does not reveal whether an email exists", async () => {
    await expect(
      auth.api.requestPasswordReset({ body: { email: "ghost@example.com", redirectTo: "/en/reset-password" } }),
    ).resolves.toBeTruthy();
    await new Promise((r) => setTimeout(r, 200));
    expect(mailer.sent).toHaveLength(0);
  });
});
```

- [ ] **Step 8: Run the integration tests**

Run: `pnpm test:int`
Expected: PASS (all of the `database` and auth suites).

If a Better Auth method or error code differs in 1.7.7, fix the call by checking `node_modules/better-auth/dist/**/*.d.ts`. For example, the reset URL shape or `requestPasswordReset` may differ. Keep each test's intent. If an error code differs, extend `authErrorKey` and add the new code to `errors.test.ts`.

- [ ] **Step 9: Commit**

```bash
pnpm lint && pnpm typecheck && pnpm test:unit
git add -A
git commit -m "feat(auth): add Better Auth with argon2id, verification, reset and rate limits"
```

---
### Task 7: Responsive app shell

**Files:**
- Create: `src/components/shell/{nav-items.ts,nav-items.test.ts,BottomTabBar.tsx,BottomTabBar.test.tsx,HeaderNav.tsx,SiteHeader.tsx,LocaleSwitcher.tsx}`, `src/app/[locale]/(main)/layout.tsx`, `src/app/[locale]/(main)/{favorites,bookings,chats}/page.tsx`

**Interfaces:**
- Consumes: `Link`, `usePathname`, `useRouter` (Task 4); `getCurrentUser`, `requireUser` (Task 6); `Logo`, `Avatar`, `buttonClasses`, `EmptyState`, `PageContainer` (Task 3); `renderWithIntl`.
- Produces:
  - `NAV_ITEMS: readonly { key: "search"|"favorites"|"bookings"|"chats"|"profile"; href: string; icon: LucideIcon }[]`
  - `isActive(pathname: string, href: string): boolean`
  - `<BottomTabBar/>` (mobile only), `<SiteHeader user={{name}|null}/>` (tablet and desktop), `<LocaleSwitcher className?/>`
  - The `(main)` layout. Pages inside it render their own `PageContainer`.

- [ ] **Step 1: Write failing tests**

`src/components/shell/nav-items.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { isActive, NAV_ITEMS } from "./nav-items";

describe("NAV_ITEMS", () => {
  it("matches the five tabs from the designs, in order", () => {
    expect(NAV_ITEMS.map((i) => i.key)).toEqual(["search", "favorites", "bookings", "chats", "profile"]);
  });
});

describe("isActive", () => {
  it("treats home and search results as the Search tab", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/search", "/")).toBe(true);
    expect(isActive("/favorites", "/")).toBe(false);
  });

  it("matches a section and its children but not look-alike paths", () => {
    expect(isActive("/profile", "/profile")).toBe(true);
    expect(isActive("/profile/edit", "/profile")).toBe(true);
    expect(isActive("/profiles", "/profile")).toBe(false);
  });
});
```

`src/components/shell/BottomTabBar.test.tsx`:
```tsx
import { screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { BottomTabBar } from "./BottomTabBar";

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/favorites",
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("BottomTabBar", () => {
  it("renders the five tabs with translated labels", () => {
    renderWithIntl(<BottomTabBar />, "fr");
    const nav = screen.getByRole("navigation", { name: "Navigation principale" });
    expect(nav.querySelectorAll("a")).toHaveLength(5);
    expect(screen.getByRole("link", { name: "Rechercher" })).toHaveAttribute("href", "/");
  });

  it("marks only the current tab as the current page", () => {
    renderWithIntl(<BottomTabBar />);
    expect(screen.getByRole("link", { name: "Favorites" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Search" })).not.toHaveAttribute("aria-current");
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm test:unit src/components/shell`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`src/components/shell/nav-items.ts`:
```ts
import { Heart, House, MessageSquare, Search, User, type LucideIcon } from "lucide-react";

export type NavKey = "search" | "favorites" | "bookings" | "chats" | "profile";

export const NAV_ITEMS: readonly { key: NavKey; href: string; icon: LucideIcon }[] = [
  { key: "search", href: "/", icon: Search },
  { key: "favorites", href: "/favorites", icon: Heart },
  { key: "bookings", href: "/bookings", icon: House },
  { key: "chats", href: "/chats", icon: MessageSquare },
  { key: "profile", href: "/profile", icon: User },
];

/** `pathname` is locale-less, as returned by next-intl's usePathname. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname === "/search" || pathname.startsWith("/search/");
  return pathname === href || pathname.startsWith(`${href}/`);
}
```

`src/components/shell/BottomTabBar.tsx`:
```tsx
"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { isActive, NAV_ITEMS } from "./nav-items";

export function BottomTabBar() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("mainNav")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("relative flex flex-col items-center gap-1 py-2 text-[11px]", active ? "font-semibold text-primary" : "text-muted")}
              >
                {active && <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary" aria-hidden="true" />}
                <Icon className="size-6" aria-hidden="true" />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

`src/components/shell/HeaderNav.tsx`:
```tsx
"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { isActive, NAV_ITEMS } from "./nav-items";

export function HeaderNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("mainNav")}>
      <ul className="flex items-center gap-6">
        {NAV_ITEMS.filter((item) => item.key !== "profile").map(({ key, href }) => {
          const active = isActive(pathname, href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("text-sm font-medium transition-colors hover:text-primary", active ? "text-primary" : "text-ink")}
              >
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

`src/components/shell/LocaleSwitcher.tsx`:
```tsx
"use client";

import { Globe } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, toAppLocale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("Locale");
  const tNav = useTranslations("Nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  return (
    <label className={cn("flex items-center gap-1 text-sm text-muted", className)}>
      <Globe className="size-4" aria-hidden="true" />
      <span className="sr-only">{tNav("language")}</span>
      <select
        value={locale}
        disabled={isPending}
        onChange={(event) => {
          const next = toAppLocale(event.target.value);
          startTransition(() => {
            router.replace({ pathname, query: Object.fromEntries(searchParams) }, { locale: next });
          });
        }}
        className="cursor-pointer bg-transparent text-ink outline-none"
      >
        {routing.locales.map((value) => (
          <option key={value} value={value}>
            {t(value)}
          </option>
        ))}
      </select>
    </label>
  );
}
```

`src/components/shell/SiteHeader.tsx`:
```tsx
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { Link } from "@/i18n/navigation";
import { HeaderNav } from "./HeaderNav";
import { LocaleSwitcher } from "./LocaleSwitcher";

export async function SiteHeader({ user }: { user: { name: string } | null }) {
  const t = await getTranslations("Nav");

  return (
    <header className="sticky top-0 z-40 hidden border-b border-line bg-surface/95 backdrop-blur md:block">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-10 px-6">
        <Link href="/" className="shrink-0">
          <Logo withWordmark />
        </Link>
        <HeaderNav />
        <div className="ml-auto flex items-center gap-3">
          <Suspense>
            <LocaleSwitcher />
          </Suspense>
          {user ? (
            <Link href="/profile" className="rounded-full focus-visible:outline-2 focus-visible:outline-primary">
              <Avatar name={user.name} />
              <span className="sr-only">{t("profile")}</span>
            </Link>
          ) : (
            <>
              <Link href="/login" className={buttonClasses({ variant: "ghost" })}>
                {t("login")}
              </Link>
              <Link href="/signup" className={buttonClasses()}>
                {t("signup")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
```

`src/app/[locale]/(main)/layout.tsx`:
```tsx
import type { ReactNode } from "react";
import { BottomTabBar } from "@/components/shell/BottomTabBar";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { getCurrentUser } from "@/lib/session";

export default async function MainLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  return (
    <>
      <SiteHeader user={user ? { name: user.name } : null} />
      <main className="min-h-dvh pb-24 md:pb-12">{children}</main>
      <BottomTabBar />
    </>
  );
}
```

`src/app/[locale]/(main)/favorites/page.tsx`:
```tsx
import { Heart } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { requireUser } from "@/lib/session";

export default async function FavoritesPage() {
  await requireUser("/favorites");
  const t = await getTranslations("Empty");
  const tNav = await getTranslations("Nav");
  return (
    <PageContainer className="py-6">
      <h1 className="text-2xl font-semibold">{tNav("favorites")}</h1>
      <EmptyState icon={<Heart />} title={t("favoritesTitle")} body={t("favoritesBody")} />
    </PageContainer>
  );
}
```

`src/app/[locale]/(main)/bookings/page.tsx`:
```tsx
import { House } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { requireUser } from "@/lib/session";

export default async function BookingsPage() {
  await requireUser("/bookings");
  const t = await getTranslations("Empty");
  const tNav = await getTranslations("Nav");
  return (
    <PageContainer className="py-6">
      <h1 className="text-2xl font-semibold">{tNav("bookings")}</h1>
      <EmptyState icon={<House />} title={t("bookingsTitle")} body={t("bookingsBody")} />
    </PageContainer>
  );
}
```

`src/app/[locale]/(main)/chats/page.tsx`:
```tsx
import { MessageSquare } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { requireUser } from "@/lib/session";

export default async function ChatsPage() {
  await requireUser("/chats");
  const t = await getTranslations("Empty");
  const tNav = await getTranslations("Nav");
  return (
    <PageContainer className="py-6">
      <h1 className="text-2xl font-semibold">{tNav("chats")}</h1>
      <EmptyState icon={<MessageSquare />} title={t("chatsTitle")} body={t("chatsBody")} />
    </PageContainer>
  );
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm test:unit src/components/shell && pnpm typecheck`
Expected: PASS (6 tests). Typecheck is clean.

- [ ] **Step 5: Check visually**

Run `pnpm dev` and open `http://localhost:3000/en` with the browser devtools device toolbar:
- **390px wide:** only the bottom tab bar is visible.
- **1440px wide:** only the header is visible.
- **`/en/favorites` while logged out:** redirects to `/en/login?next=%2Ffavorites` (a 404 is expected until Task 8 adds the page).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(shell): add responsive header and bottom tab bar"
```

---

### Task 8: Auth pages

**Files:**
- Create: `src/features/auth/components/{AuthHeading,PasswordField,SignupForm,LoginForm,ForgotPasswordForm,ResetPasswordForm,ResendVerificationButton}.tsx`, `src/features/auth/components/{SignupForm,LoginForm}.test.tsx`, `src/app/[locale]/(auth)/layout.tsx`, `src/app/[locale]/(auth)/{signup,login,check-email,verified,forgot-password,reset-password}/page.tsx`

**Interfaces:**
- Consumes: `authClient` (`signUp.email`, `signIn.email`, `requestPasswordReset`, `resetPassword`, `sendVerificationEmail`); the schemas, `authErrorKey`, `fieldForAuthError`, `firstErrors`, `safeNextPath`, `getCurrentUser`, `redirect`; and the UI primitives.
- Produces: `/[locale]/signup | login | check-email?email= | verified | forgot-password | reset-password?token=`. Signed-in users who visit login or signup are redirected to `/`.

- [ ] **Step 1: Write failing component tests**

`src/features/auth/components/SignupForm.test.tsx`:
```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { SignupForm } from "./SignupForm";

const { signUpEmail, push } = vi.hoisted(() => ({ signUpEmail: vi.fn(), push: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient: { signUp: { email: signUpEmail } } }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }), Link: (p: { children: React.ReactNode }) => <a>{p.children}</a> }));

async function fill(name: string, email: string, password: string) {
  if (name) await userEvent.type(screen.getByLabelText("Full name"), name);
  if (email) await userEvent.type(screen.getByLabelText("Email"), email);
  if (password) await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Create account" }));
}

describe("SignupForm", () => {
  beforeEach(() => {
    signUpEmail.mockReset();
    push.mockReset();
  });

  it("validates on the client before calling the server", async () => {
    renderWithIntl(<SignupForm />);
    await fill("", "not-an-email", "short");
    expect(screen.getByText("Enter your name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Password must be at least 8 characters.")).toBeInTheDocument();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("sends locale and callback URL, then goes to check-email", async () => {
    signUpEmail.mockResolvedValue({ data: {}, error: null });
    renderWithIntl(<SignupForm />, "rw");
    await userEvent.type(screen.getByLabelText("Amazina yose"), "Alona");
    await userEvent.type(screen.getByLabelText("Imeyili"), "Alona@Example.com");
    await userEvent.type(screen.getByLabelText("Ijambo ry'ibanga"), "umuganda-blue-42");
    await userEvent.click(screen.getByRole("button", { name: "Fungura konti" }));
    expect(signUpEmail).toHaveBeenCalledWith({
      name: "Alona",
      email: "alona@example.com",
      password: "umuganda-blue-42",
      locale: "rw",
      callbackURL: "/rw/verified",
    });
    expect(push).toHaveBeenCalledWith({ pathname: "/check-email", query: { email: "alona@example.com" } });
  });

  it("shows server errors next to the right field", async () => {
    signUpEmail.mockResolvedValue({ data: null, error: { code: "PASSWORD_TOO_COMMON", status: 400 } });
    renderWithIntl(<SignupForm />);
    await fill("Alona", "a@example.com", "password123");
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("This password is too common. Choose another one.");
    expect(push).not.toHaveBeenCalled();
  });
});
```

`src/features/auth/components/LoginForm.test.tsx`:
```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { LoginForm } from "./LoginForm";

const { signInEmail, push, refresh } = vi.hoisted(() => ({ signInEmail: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient: { signIn: { email: signInEmail } } }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push, refresh }), Link: (p: { children: React.ReactNode }) => <a>{p.children}</a> }));

async function submit(email = "a@example.com", password = "whatever-123") {
  await userEvent.type(screen.getByLabelText("Email"), email);
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Log in" }));
}

describe("LoginForm", () => {
  beforeEach(() => {
    signInEmail.mockReset();
    push.mockReset();
  });

  it("goes to the safe `next` path after signing in", async () => {
    signInEmail.mockResolvedValue({ data: {}, error: null });
    renderWithIntl(<LoginForm next="/profile" />);
    await submit();
    expect(signInEmail).toHaveBeenCalledWith({ email: "a@example.com", password: "whatever-123", callbackURL: "/en/verified" });
    expect(push).toHaveBeenCalledWith("/profile");
    expect(refresh).toHaveBeenCalled();
  });

  it("ignores an unsafe `next` path", async () => {
    signInEmail.mockResolvedValue({ data: {}, error: null });
    renderWithIntl(<LoginForm next="//evil.com" />);
    await submit();
    expect(push).toHaveBeenCalledWith("/");
  });

  it("shows a friendly message for wrong credentials", async () => {
    signInEmail.mockResolvedValue({ data: null, error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 } });
    renderWithIntl(<LoginForm />);
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent("Wrong email or password.");
    expect(push).not.toHaveBeenCalled();
  });

  it("explains unverified accounts", async () => {
    signInEmail.mockResolvedValue({ data: null, error: { code: "EMAIL_NOT_VERIFIED", status: 403 } });
    renderWithIntl(<LoginForm />);
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent("Please verify your email first.");
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm test:unit src/features/auth/components`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the form components**

`src/features/auth/components/AuthHeading.tsx`:
```tsx
export function AuthHeading({ title, body }: { title: string; body?: string }) {
  return (
    <div className="mb-8 flex flex-col gap-2 text-center md:text-left">
      <h1 className="text-3xl font-semibold text-primary">{title}</h1>
      {body && <p className="text-sm text-muted">{body}</p>}
    </div>
  );
}
```

`src/features/auth/components/PasswordField.tsx`:
```tsx
"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { TextField, type TextFieldProps } from "@/components/ui/TextField";

export function PasswordField(props: Omit<TextFieldProps, "type" | "trailing">) {
  const t = useTranslations("Auth");
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("hidePassword") : t("showPassword")}
          aria-pressed={visible}
          className="text-muted hover:text-ink"
        >
          {visible ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
        </button>
      }
    />
  );
}
```

`src/features/auth/components/SignupForm.tsx`:
```tsx
"use client";

import { Mail, User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { authErrorKey, fieldForAuthError, type AuthErrorKey } from "@/features/auth/errors";
import { signupSchema } from "@/features/auth/schemas";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { firstErrors } from "@/lib/zod-errors";
import { PasswordField } from "./PasswordField";

type Errors = Partial<Record<"name" | "email" | "password" | "form", AuthErrorKey>>;

export function SignupForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const message = (key?: AuthErrorKey) => (key ? t(`errors.${key}`) : undefined);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = signupSchema.safeParse({ name: form.get("name"), email: form.get("email"), password: form.get("password") });
    if (!parsed.success) {
      setErrors(firstErrors(parsed.error) as Errors);
      return;
    }
    setErrors({});
    setPending(true);
    const { error } = await authClient.signUp.email({ ...parsed.data, locale, callbackURL: `/${locale}/verified` });
    setPending(false);
    if (error) {
      const key = authErrorKey(error);
      setErrors({ [fieldForAuthError(key)]: key });
      return;
    }
    router.push({ pathname: "/check-email", query: { email: parsed.data.email } });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <TextField name="name" label={t("name")} icon={<User />} autoComplete="name" error={message(errors.name)} />
      <TextField name="email" type="email" label={t("email")} icon={<Mail />} autoComplete="email" error={message(errors.email)} />
      <PasswordField name="password" label={t("password")} autoComplete="new-password" hint={t("passwordHint")} error={message(errors.password)} />
      {errors.form && (
        <p role="alert" className="text-sm text-danger">
          {message(errors.form)}
        </p>
      )}
      <Button type="submit" size="lg" fullWidth loading={pending}>
        {t("createAccount")}
      </Button>
      <p className="text-center text-xs text-muted">{t("terms")}</p>
    </form>
  );
}
```

`src/features/auth/components/LoginForm.tsx`:
```tsx
"use client";

import { Mail } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { authErrorKey, type AuthErrorKey } from "@/features/auth/errors";
import { loginSchema } from "@/features/auth/schemas";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { safeNextPath } from "@/lib/safe-redirect";
import { PasswordField } from "./PasswordField";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
    if (!parsed.success) {
      setError("invalidCredentials");
      return;
    }
    setError(null);
    setPending(true);
    const result = await authClient.signIn.email({ ...parsed.data, callbackURL: `/${locale}/verified` });
    setPending(false);
    if (result.error) {
      setError(authErrorKey(result.error));
      return;
    }
    router.push(safeNextPath(next));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <TextField name="email" type="email" label={t("email")} icon={<Mail />} autoComplete="email" />
      <PasswordField name="password" label={t("password")} autoComplete="current-password" />
      <Link href="/forgot-password" className="self-start text-sm text-primary underline">
        {t("forgotPassword")}
      </Link>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {t(`errors.${error}`)}
        </p>
      )}
      <Button type="submit" size="lg" fullWidth loading={pending}>
        {t("logIn")}
      </Button>
    </form>
  );
}
```

`src/features/auth/components/ForgotPasswordForm.tsx`:
```tsx
"use client";

import { Mail } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { authErrorKey } from "@/features/auth/errors";
import { forgotPasswordSchema } from "@/features/auth/schemas";
import { authClient } from "@/lib/auth-client";

type Status = "idle" | "sent" | "invalid" | "tooMany";

export function ForgotPasswordForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [status, setStatus] = useState<Status>("idle");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = forgotPasswordSchema.safeParse({ email: new FormData(event.currentTarget).get("email") });
    if (!parsed.success) {
      setStatus("invalid");
      return;
    }
    setPending(true);
    const { error } = await authClient.requestPasswordReset({ email: parsed.data.email, redirectTo: `/${locale}/reset-password` });
    setPending(false);
    // Always report "sent" (except rate limiting) so the form never reveals which emails have accounts.
    setStatus(error && authErrorKey(error) === "tooMany" ? "tooMany" : "sent");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <TextField
        name="email"
        type="email"
        label={t("email")}
        icon={<Mail />}
        autoComplete="email"
        error={status === "invalid" ? t("errors.emailInvalid") : undefined}
      />
      {status === "sent" && (
        <p role="status" className="text-sm text-success">
          {t("linkSent")}
        </p>
      )}
      {status === "tooMany" && (
        <p role="alert" className="text-sm text-danger">
          {t("errors.tooMany")}
        </p>
      )}
      <Button type="submit" size="lg" fullWidth loading={pending}>
        {t("sendLink")}
      </Button>
    </form>
  );
}
```

`src/features/auth/components/ResetPasswordForm.tsx`:
```tsx
"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { authErrorKey, type AuthErrorKey } from "@/features/auth/errors";
import { resetPasswordSchema } from "@/features/auth/schemas";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { firstErrors } from "@/lib/zod-errors";
import { PasswordField } from "./PasswordField";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const t = useTranslations("Auth");
  const [error, setError] = useState<AuthErrorKey | null>(token ? null : "invalidToken");
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  if (done) {
    return (
      <div className="flex flex-col gap-5">
        <p role="status" className="text-sm text-success">
          {t("resetDone")}
        </p>
        <Link href="/login" className={buttonClasses({ size: "lg", fullWidth: true })}>
          {t("logIn")}
        </Link>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const parsed = resetPasswordSchema.safeParse({ password: new FormData(event.currentTarget).get("password") });
    if (!parsed.success) {
      setError(firstErrors(parsed.error).password as AuthErrorKey);
      return;
    }
    setPending(true);
    const result = await authClient.resetPassword({ newPassword: parsed.data.password, token });
    setPending(false);
    if (result.error) {
      setError(authErrorKey(result.error));
      return;
    }
    setDone(true);
  }

  const passwordError = error && error.startsWith("password") ? t(`errors.${error}`) : undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <PasswordField
        name="password"
        label={t("newPassword")}
        autoComplete="new-password"
        hint={t("passwordHint")}
        error={passwordError}
        disabled={!token}
      />
      {error && !passwordError && (
        <p role="alert" className="text-sm text-danger">
          {t(`errors.${error}`)}{" "}
          {error === "invalidToken" && (
            <Link href="/forgot-password" className="underline">
              {t("forgotTitle")}
            </Link>
          )}
        </p>
      )}
      <Button type="submit" size="lg" fullWidth loading={pending} disabled={!token}>
        {t("resetSubmit")}
      </Button>
    </form>
  );
}
```

`src/features/auth/components/ResendVerificationButton.tsx`:
```tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { authErrorKey } from "@/features/auth/errors";
import { authClient } from "@/lib/auth-client";

export function ResendVerificationButton({ email }: { email: string }) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [status, setStatus] = useState<"idle" | "sent" | "tooMany" | "error">("idle");
  const [pending, setPending] = useState(false);

  async function resend() {
    setPending(true);
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: `/${locale}/verified` });
    setPending(false);
    setStatus(!error ? "sent" : authErrorKey(error) === "tooMany" ? "tooMany" : "error");
  }

  return (
    <div className="flex flex-col gap-3">
      <Button variant="outline" size="lg" fullWidth loading={pending} onClick={resend}>
        {t("resend")}
      </Button>
      {status === "sent" && (
        <p role="status" className="text-sm text-success">
          {t("resent")}
        </p>
      )}
      {(status === "tooMany" || status === "error") && (
        <p role="alert" className="text-sm text-danger">
          {t(status === "tooMany" ? "errors.tooMany" : "errors.generic")}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the component tests and confirm they pass**

Run: `pnpm test:unit src/features/auth/components`
Expected: PASS (7 tests).

- [ ] **Step 5: Layout and pages**

`src/app/[locale]/(auth)/layout.tsx` (split screen on desktop, full screen on mobile):
```tsx
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { LocaleSwitcher } from "@/components/shell/LocaleSwitcher";
import { LogoMark } from "@/components/ui/Logo";
import { Link } from "@/i18n/navigation";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("Auth");
  const tNav = await getTranslations("Nav");

  return (
    <div className="grid min-h-dvh md:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-primary p-10 text-white md:flex">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark className="h-8 w-9 text-primary-soft" />
          <span className="text-xl font-bold">Space Rental</span>
        </Link>
        <p className="max-w-md text-5xl font-semibold leading-tight">{t("tagline")}</p>
        <p className="text-sm text-primary-soft">Kigali · Musanze · Rubavu · Huye</p>
      </aside>
      <section className="flex flex-col bg-surface px-6 py-6 md:px-16 md:py-10">
        <div className="mb-10 flex items-center justify-between">
          <Link href="/" aria-label={tNav("back")} className="text-ink">
            <ChevronLeft className="size-6" aria-hidden="true" />
          </Link>
          <Suspense>
            <LocaleSwitcher />
          </Suspense>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col md:justify-center">{children}</div>
      </section>
    </div>
  );
}
```

`src/app/[locale]/(auth)/signup/page.tsx`:
```tsx
import { getLocale, getTranslations } from "next-intl/server";
import { AuthHeading } from "@/features/auth/components/AuthHeading";
import { SignupForm } from "@/features/auth/components/SignupForm";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect({ href: "/", locale: await getLocale() });
  const t = await getTranslations("Auth");
  return (
    <>
      <AuthHeading title={t("signupTitle")} />
      <SignupForm />
      <p className="mt-6 text-center text-sm">
        {t("haveAccount")}{" "}
        <Link href="/login" className="text-primary underline">
          {t("logIn")}
        </Link>
      </p>
    </>
  );
}
```

`src/app/[locale]/(auth)/login/page.tsx`:
```tsx
import { getLocale, getTranslations } from "next-intl/server";
import { AuthHeading } from "@/features/auth/components/AuthHeading";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { Link, redirect } from "@/i18n/navigation";
import { safeNextPath } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/lib/session";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = safeNextPath((await searchParams).next);
  if (await getCurrentUser()) redirect({ href: next, locale: await getLocale() });
  const t = await getTranslations("Auth");
  return (
    <>
      <AuthHeading title={t("loginTitle")} />
      <LoginForm next={next} />
      <p className="mt-6 text-center text-sm">
        {t("noAccount")}{" "}
        <Link href="/signup" className="text-primary underline">
          {t("createAccount")}
        </Link>
      </p>
    </>
  );
}
```

`src/app/[locale]/(auth)/check-email/page.tsx`:
```tsx
import { MailCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/features/auth/components/AuthHeading";
import { ResendVerificationButton } from "@/features/auth/components/ResendVerificationButton";
import { emailSchema } from "@/features/auth/schemas";

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ email?: string | string[] }> }) {
  const t = await getTranslations("Auth");
  const parsed = emailSchema.safeParse((await searchParams).email);
  const email = parsed.success ? parsed.data : null;
  return (
    <>
      <MailCheck className="mx-auto mb-6 size-12 text-primary md:mx-0" aria-hidden="true" />
      <AuthHeading title={t("checkEmailTitle")} body={email ? t("checkEmailBody", { email }) : t("checkEmailNoAddress")} />
      {email && <ResendVerificationButton email={email} />}
    </>
  );
}
```

`src/app/[locale]/(auth)/verified/page.tsx`:
```tsx
import { BadgeCheck, CircleAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonClasses } from "@/components/ui/Button";
import { AuthHeading } from "@/features/auth/components/AuthHeading";
import { Link } from "@/i18n/navigation";

export default async function VerifiedPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const t = await getTranslations("Auth");
  const failed = Boolean((await searchParams).error);
  return (
    <>
      {failed ? (
        <CircleAlert className="mx-auto mb-6 size-12 text-danger md:mx-0" aria-hidden="true" />
      ) : (
        <BadgeCheck className="mx-auto mb-6 size-12 text-success md:mx-0" aria-hidden="true" />
      )}
      <AuthHeading title={failed ? t("errors.invalidToken") : t("verifiedTitle")} body={failed ? undefined : t("verifiedBody")} />
      <Link href={failed ? "/login" : "/"} className={buttonClasses({ size: "lg", fullWidth: true })}>
        {failed ? t("backToLogin") : t("continue")}
      </Link>
    </>
  );
}
```

`src/app/[locale]/(auth)/forgot-password/page.tsx`:
```tsx
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/features/auth/components/AuthHeading";
import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";
import { Link } from "@/i18n/navigation";

export default async function ForgotPasswordPage() {
  const t = await getTranslations("Auth");
  return (
    <>
      <AuthHeading title={t("forgotTitle")} body={t("forgotBody")} />
      <ForgotPasswordForm />
      <Link href="/login" className="mt-6 text-center text-sm text-primary underline">
        {t("backToLogin")}
      </Link>
    </>
  );
}
```

`src/app/[locale]/(auth)/reset-password/page.tsx`:
```tsx
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/features/auth/components/AuthHeading";
import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const t = await getTranslations("Auth");
  const { token, error } = await searchParams;
  return (
    <>
      <AuthHeading title={t("resetTitle")} />
      <ResetPasswordForm token={!error && typeof token === "string" && token ? token : null} />
    </>
  );
}
```

- [ ] **Step 6: Manual flow check**

Run `pnpm dev` (the `.env` has `MAIL_DRIVER=file`). Then:
1. Sign up at `/en/signup`. You land on check-email.
2. Open the newest file in `.mail-outbox/` and follow its link. You land on `/en/verified`.
3. Sign out (or open a private window) and log in at `/en/login`.
4. Run forgot password and follow the emailed link to `/en/reset-password?token=…`. The reset should work.

- [ ] **Step 7: Commit**

```bash
pnpm lint && pnpm typecheck && pnpm test:unit
git add -A
git commit -m "feat(auth): add sign-up, login, verification and password reset pages"
```

---
### Task 9: Profile (view, edit, language, sign out)

**Files:**
- Create: `src/features/users/{schemas,service,actions}.ts`, `src/features/users/schemas.test.ts`, `src/features/users/service.int.test.ts`, `src/features/users/components/{ProfileForm,SignOutButton}.tsx`, `src/app/[locale]/(main)/profile/page.tsx`

**Interfaces:**
- Consumes: `db`, `requireUser`, `getCurrentUser`, `authClient.signOut`, `routing`, `firstErrors`, UI primitives.
- Produces:
  - `normalizePhone(raw: string): string | null` (E.164; Rwandan `07…` numbers become `+2507…`)
  - `profileSchema` (input `{ name, phone, locale }`, output `ProfileInput = { name: string; phone: string | null; locale: AppLocale }`)
  - `type ProfileErrorKey = keyof Messages["Profile"]["errors"]`
  - `getProfile(userId)` returning `{ name, email, emailVerified, phone, locale }`
  - `updateProfile(userId, input: ProfileInput)`
  - `updateProfileAction(prev: ProfileFormState, formData: FormData): Promise<ProfileFormState>`, where `ProfileFormState = { status: "idle"|"saved"|"error"; errors?: Partial<Record<"name"|"phone"|"locale"|"form", ProfileErrorKey>>; locale?: AppLocale }`

- [ ] **Step 1: Write failing tests**

`src/features/users/schemas.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { firstErrors } from "@/lib/zod-errors";
import { normalizePhone, profileSchema } from "./schemas";

describe("normalizePhone", () => {
  it.each([
    ["0788 123 456", "+250788123456"],
    ["0788-123-456", "+250788123456"],
    ["+250 788 123 456", "+250788123456"],
    ["250788123456", "+250788123456"],
    ["00250788123456", "+250788123456"],
    ["+33 6 12 34 56 78", "+33612345678"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "12345", "0788", "abc", "+0123456789", "07881234567890123"])("rejects %j", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("profileSchema", () => {
  it("normalizes fields and treats an empty phone as no phone", () => {
    expect(profileSchema.parse({ name: " Alona ", phone: "", locale: "rw" })).toEqual({ name: "Alona", phone: null, locale: "rw" });
    expect(profileSchema.parse({ name: "A", phone: "0788 123 456", locale: "en" }).phone).toBe("+250788123456");
  });

  it("reports message keys per field", () => {
    const result = profileSchema.safeParse({ name: "", phone: "12", locale: "de" });
    expect(firstErrors(result.error!)).toEqual({ name: "nameRequired", phone: "phoneInvalid", locale: "localeInvalid" });
  });
});
```

`src/features/users/service.int.test.ts`:
```ts
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { getProfile, updateProfile } from "./service";

describe("profile service", () => {
  beforeEach(async () => {
    await resetDb();
    await db.user.create({ data: { id: "u1", name: "Alona", email: "alona@example.com" } });
    await db.user.create({ data: { id: "u2", name: "Other", email: "other@example.com" } });
  });

  it("returns only public profile fields", async () => {
    expect(await getProfile("u1")).toEqual({ name: "Alona", email: "alona@example.com", emailVerified: false, phone: null, locale: "en" });
  });

  it("updates name, phone and locale for that user only", async () => {
    await updateProfile("u1", { name: "Alona K", phone: "+250788123456", locale: "fr" });
    expect(await getProfile("u1")).toMatchObject({ name: "Alona K", phone: "+250788123456", locale: "fr" });
    expect(await getProfile("u2")).toMatchObject({ name: "Other", phone: null, locale: "en" });
  });

  it("can clear the phone number", async () => {
    await updateProfile("u1", { name: "Alona", phone: "+250788123456", locale: "en" });
    await updateProfile("u1", { name: "Alona", phone: null, locale: "en" });
    expect((await getProfile("u1"))?.phone).toBeNull();
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm test:unit src/features/users && pnpm test:int src/features/users`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the schema and service**

`src/features/users/schemas.ts`:
```ts
import { z } from "zod";
import type { Messages } from "@/i18n/messages";
import { routing } from "@/i18n/routing";

export type ProfileErrorKey = keyof Messages["Profile"]["errors"];

/** Returns an E.164 number, or null if the input is not a plausible phone number. */
export function normalizePhone(raw: string): string | null {
  let value = raw.replace(/[\s\-().]/g, "");
  if (/^07\d{8}$/.test(value)) value = `+250${value.slice(1)}`;
  else if (/^2507\d{8}$/.test(value)) value = `+${value}`;
  else if (value.startsWith("00")) value = `+${value.slice(2)}`;
  return /^\+[1-9]\d{7,14}$/.test(value) ? value : null;
}

export const profileSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(80, "nameTooLong"),
  phone: z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      const phone = normalizePhone(value);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: "phoneInvalid" });
        return z.NEVER;
      }
      return phone;
    }),
  locale: z.enum(routing.locales, "localeInvalid"),
});

export type ProfileInput = z.output<typeof profileSchema>;
```

`src/features/users/service.ts`:
```ts
import "server-only";
import { db } from "@/lib/db";
import type { ProfileInput } from "./schemas";

const PROFILE_FIELDS = { name: true, email: true, emailVerified: true, phone: true, locale: true } as const;

export function getProfile(userId: string) {
  return db.user.findUnique({ where: { id: userId }, select: PROFILE_FIELDS });
}

export function updateProfile(userId: string, input: ProfileInput) {
  return db.user.update({
    where: { id: userId },
    data: { name: input.name, phone: input.phone, locale: input.locale },
    select: PROFILE_FIELDS,
  });
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm test:unit src/features/users && pnpm test:int src/features/users`
Expected: PASS (unit: 14 tests, integration: 3 tests).

- [ ] **Step 5: Server action, components and page**

`src/features/users/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { logger } from "@/lib/logger";
import { getCurrentUser } from "@/lib/session";
import { firstErrors } from "@/lib/zod-errors";
import { profileSchema, type ProfileErrorKey } from "./schemas";
import { updateProfile } from "./service";

export type ProfileFormState = {
  status: "idle" | "saved" | "error";
  errors?: Partial<Record<"name" | "phone" | "locale" | "form", ProfileErrorKey>>;
  locale?: AppLocale;
};

export async function updateProfileAction(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", errors: { form: "generic" } };

  const parsed = profileSchema.safeParse({
    name: formData.get("name") ?? "",
    phone: formData.get("phone") ?? "",
    locale: formData.get("locale") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", errors: firstErrors(parsed.error) as ProfileFormState["errors"] };
  }

  try {
    await updateProfile(user.id, parsed.data);
  } catch (err) {
    logger.error({ err, userId: user.id }, "profile update failed");
    return { status: "error", errors: { form: "generic" } };
  }
  revalidatePath("/[locale]", "layout");
  return { status: "saved", locale: parsed.data.locale };
}
```

`src/features/users/components/ProfileForm.tsx`:
```tsx
"use client";

import { BadgeCheck, Phone, User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { updateProfileAction, type ProfileFormState } from "@/features/users/actions";
import type { ProfileErrorKey } from "@/features/users/schemas";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

type Profile = { name: string; email: string; emailVerified: boolean; phone: string | null; locale: AppLocale };

const INITIAL: ProfileFormState = { status: "idle" };

export function ProfileForm({ profile }: { profile: Profile }) {
  const t = useTranslations("Profile");
  const tLocale = useTranslations("Locale");
  const tCommon = useTranslations("Common");
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [state, formAction, pending] = useActionState(updateProfileAction, INITIAL);

  useEffect(() => {
    if (state.status === "saved" && state.locale && state.locale !== currentLocale) {
      router.replace(pathname, { locale: state.locale });
    }
  }, [state, currentLocale, pathname, router]);

  const error = (key?: ProfileErrorKey) => (key ? t(`errors.${key}`) : undefined);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <TextField name="name" label={t("name")} icon={<User />} defaultValue={profile.name} autoComplete="name" error={error(state.errors?.name)} />

      <div className="flex flex-col gap-1">
        <span className="text-sm text-muted">{t("email")}</span>
        <div className="flex items-center gap-2 border-b border-line py-2">
          <span className="flex-1 text-base">{profile.email}</span>
          {profile.emailVerified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">
              <BadgeCheck className="size-3.5" aria-hidden="true" />
              {t("verified")}
            </span>
          ) : (
            <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-muted">{t("notVerified")}</span>
          )}
        </div>
      </div>

      <TextField
        name="phone"
        type="tel"
        label={t("phone")}
        icon={<Phone />}
        defaultValue={profile.phone ?? ""}
        autoComplete="tel"
        hint={t("phoneHint")}
        error={error(state.errors?.phone)}
      />

      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">{t("language")}</span>
        <select name="locale" defaultValue={profile.locale} className="border-b border-line bg-transparent py-2 text-base outline-none focus:border-primary">
          {routing.locales.map((value) => (
            <option key={value} value={value}>
              {tLocale(value)}
            </option>
          ))}
        </select>
        {state.errors?.locale && (
          <span role="alert" className="text-xs text-danger">
            {error(state.errors.locale)}
          </span>
        )}
      </label>

      {state.errors?.form && (
        <p role="alert" className="text-sm text-danger">
          {error(state.errors.form)}
        </p>
      )}

      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" loading={pending} className="min-w-40">
          {pending ? tCommon("saving") : tCommon("save")}
        </Button>
        {state.status === "saved" && !pending && (
          <p role="status" className="text-sm text-success">
            {tCommon("saved")}
          </p>
        )}
      </div>
    </form>
  );
}
```

`src/features/users/components/SignOutButton.tsx`:
```tsx
"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const t = useTranslations("Profile");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="outline"
      size="lg"
      loading={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      <LogOut className="size-4" aria-hidden="true" />
      {t("signOut")}
    </Button>
  );
}
```

`src/app/[locale]/(main)/profile/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/Avatar";
import { PageContainer } from "@/components/ui/PageContainer";
import { ProfileForm } from "@/features/users/components/ProfileForm";
import { SignOutButton } from "@/features/users/components/SignOutButton";
import { getProfile } from "@/features/users/service";
import { toAppLocale } from "@/i18n/routing";
import { requireUser } from "@/lib/session";

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const profile = await getProfile(user.id);
  if (!profile) notFound();
  const t = await getTranslations("Profile");

  return (
    <PageContainer className="max-w-2xl py-8">
      <div className="mb-8 flex items-center gap-4">
        <Avatar name={profile.name} className="size-16 text-xl" />
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted">{profile.email}</p>
        </div>
      </div>
      <div className="rounded-card bg-surface p-6">
        <ProfileForm profile={{ ...profile, locale: toAppLocale(profile.locale) }} />
      </div>
      <div className="mt-6">
        <SignOutButton />
      </div>
    </PageContainer>
  );
}
```

- [ ] **Step 6: Verify and commit**

Run: `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:int`
Expected: all pass.

Then run `pnpm dev`, sign in, and on `/en/profile`:
1. Change the phone to `0788 123 456` and save. You see "Saved", and after a reload the phone shows as `+250788123456`.
2. Change the language to Français and save. The URL becomes `/fr/profile`.

```bash
git add -A
git commit -m "feat(profile): add editable profile with phone normalization and language"
```

---

### Task 10: Home search, search results page, onboarding and PWA manifest

**Files:**
- Create:
  - `src/features/search/params.ts`, `src/features/search/params.test.ts`
  - `src/features/search/components/{HomeSearch.tsx,HomeSearch.test.tsx}`
  - `src/features/onboarding/constants.ts`
  - `src/features/onboarding/components/{OnboardingCarousel.tsx,OnboardingCarousel.test.tsx,OnboardingGate.tsx,Welcome.tsx}`
  - `src/app/[locale]/welcome/page.tsx`, `src/app/[locale]/(main)/search/page.tsx`
  - `src/app/manifest.ts`, `src/app/icon.svg`
- Modify: `src/app/[locale]/(main)/page.tsx` (real home page)
- Delete: `src/app/favicon.ico`

**Interfaces:**
- Produces:
  - `type SearchMode = "short" | "long"`, `type SearchQuery = { mode; location?; checkIn?; checkOut?; guests? }`
  - `buildSearchQuery(mode, values: Record<string, FormDataEntryValue | undefined>): Record<string,string>`
  - `parseSearchParams(params: Record<string, string | string[] | undefined>): SearchQuery`
  - `ONBOARDED_COOKIE = "sr_onboarded"`
  - Phase 3 replaces the date and guest inputs with the designed pickers and the empty results with real listings. The query format above stays stable.

- [ ] **Step 1: Write failing tests**

`src/features/search/params.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildSearchQuery, parseSearchParams } from "./params";

describe("buildSearchQuery", () => {
  it("keeps only filled short-term fields", () => {
    expect(buildSearchQuery("short", { location: " Kigali ", checkIn: "2026-11-01", checkOut: "", guests: "2" })).toEqual({
      mode: "short",
      location: "Kigali",
      checkIn: "2026-11-01",
      guests: "2",
    });
  });

  it("drops dates and guests for long-term searches", () => {
    expect(buildSearchQuery("long", { location: "Musanze", checkIn: "2026-11-01", guests: "3" })).toEqual({ mode: "long", location: "Musanze" });
  });
});

describe("parseSearchParams", () => {
  it("parses a valid short-term query", () => {
    expect(parseSearchParams({ mode: "short", location: "Kigali", checkIn: "2026-11-01", checkOut: "2026-11-04", guests: "2" })).toEqual({
      mode: "short",
      location: "Kigali",
      checkIn: "2026-11-01",
      checkOut: "2026-11-04",
      guests: 2,
    });
  });

  it("sanitizes garbage instead of throwing", () => {
    expect(
      parseSearchParams({ mode: "xyz", location: ["a", "b"], checkIn: "2026-02-31", checkOut: "tomorrow", guests: "-4" }),
    ).toEqual({ mode: "short", location: "a" });
  });

  it("drops a check-out that is not after check-in", () => {
    expect(parseSearchParams({ checkIn: "2026-11-05", checkOut: "2026-11-05" })).toEqual({ mode: "short", checkIn: "2026-11-05" });
  });

  it("caps guests and location length", () => {
    const parsed = parseSearchParams({ guests: "500", location: "x".repeat(300) });
    expect(parsed.guests).toBeUndefined();
    expect(parsed.location).toHaveLength(100);
  });

  it("ignores dates and guests in long-term mode", () => {
    expect(parseSearchParams({ mode: "long", checkIn: "2026-11-01", guests: "2" })).toEqual({ mode: "long" });
  });
});
```

`src/features/search/components/HomeSearch.test.tsx`:
```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { HomeSearch } from "./HomeSearch";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push }) }));

describe("HomeSearch", () => {
  beforeEach(() => push.mockReset());

  it("submits a short-term search", async () => {
    renderWithIntl(<HomeSearch />);
    await userEvent.type(screen.getByLabelText("Location"), "Kigali");
    await userEvent.type(screen.getByLabelText("Number of guests"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(push).toHaveBeenCalledWith({ pathname: "/search", query: { mode: "short", location: "Kigali", guests: "2" } });
  });

  it("hides dates and guests for 'From 6 months'", async () => {
    renderWithIntl(<HomeSearch />);
    await userEvent.click(screen.getByRole("radio", { name: "From 6 months" }));
    expect(screen.queryByLabelText("Check-in")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Number of guests")).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Location"), "Musanze");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(push).toHaveBeenCalledWith({ pathname: "/search", query: { mode: "long", location: "Musanze" } });
  });
});
```

`src/features/onboarding/components/OnboardingCarousel.test.tsx`:
```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { OnboardingCarousel } from "./OnboardingCarousel";

describe("OnboardingCarousel", () => {
  it("walks through three slides and finishes on 'Get started'", async () => {
    const onFinish = vi.fn();
    renderWithIntl(<OnboardingCarousel onFinish={onFinish} />);
    expect(screen.getByRole("heading", { name: "Rent your perfect fit" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Search by location" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Save favorites" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Get started" }));
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("can be skipped from the first slide", async () => {
    const onFinish = vi.fn();
    renderWithIntl(<OnboardingCarousel onFinish={onFinish} />);
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onFinish).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm test:unit src/features/search src/features/onboarding`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`src/features/search/params.ts`:
```ts
export type SearchMode = "short" | "long";

export type SearchQuery = {
  mode: SearchMode;
  location?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
};

const MAX_GUESTS = 30;
const MAX_LOCATION = 100;

type Raw = string | string[] | undefined;
const first = (value: Raw) => (Array.isArray(value) ? value[0] : value);

function isoDate(value: Raw): string | undefined {
  const v = first(value);
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const date = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v ? v : undefined;
}

function guestCount(value: Raw): number | undefined {
  const v = first(value);
  if (!v || !/^\d+$/.test(v)) return undefined;
  const n = Number(v);
  return n >= 1 && n <= MAX_GUESTS ? n : undefined;
}

export function parseSearchParams(params: Record<string, Raw>): SearchQuery {
  const mode: SearchMode = first(params.mode) === "long" ? "long" : "short";
  const query: SearchQuery = { mode };
  const location = first(params.location)?.trim().slice(0, MAX_LOCATION);
  if (location) query.location = location;
  if (mode === "long") return query;

  const checkIn = isoDate(params.checkIn);
  const checkOut = isoDate(params.checkOut);
  if (checkIn) query.checkIn = checkIn;
  if (checkOut && (!checkIn || checkOut > checkIn)) query.checkOut = checkOut;
  const guests = guestCount(params.guests);
  if (guests) query.guests = guests;
  return query;
}

export function buildSearchQuery(mode: SearchMode, values: Record<string, FormDataEntryValue | undefined>): Record<string, string> {
  const query: Record<string, string> = { mode };
  const keys = mode === "short" ? ["location", "checkIn", "checkOut", "guests"] : ["location"];
  for (const key of keys) {
    const value = values[key];
    if (typeof value === "string" && value.trim()) query[key] = value.trim();
  }
  return query;
}
```

`src/features/search/components/HomeSearch.tsx`:
```tsx
"use client";

import { Calendar, MapPin, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { TextField } from "@/components/ui/TextField";
import { buildSearchQuery, type SearchMode } from "@/features/search/params";
import { useRouter } from "@/i18n/navigation";

export function HomeSearch() {
  const t = useTranslations("Home");
  const router = useRouter();
  const [mode, setMode] = useState<SearchMode>("short");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    router.push({ pathname: "/search", query: buildSearchQuery(mode, values) });
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <SegmentedTabs
        label={t("modeLabel")}
        value={mode}
        onChange={setMode}
        options={[
          { value: "short", label: t("short") },
          { value: "long", label: t("long") },
        ]}
        className="md:max-w-md md:self-center"
      />
      <form onSubmit={onSubmit} className="flex flex-col gap-5 rounded-card bg-surface p-5 shadow-sm md:flex-row md:items-end md:gap-4 md:p-4 md:pl-6">
        <TextField name="location" label={t("location")} hideLabel placeholder={t("location")} icon={<MapPin />} autoComplete="off" className="md:flex-1" />
        {mode === "short" && (
          <>
            <TextField name="checkIn" type="date" label={t("checkIn")} icon={<Calendar />} className="md:w-44" />
            <TextField name="checkOut" type="date" label={t("checkOut")} icon={<Calendar />} className="md:w-44" />
            <TextField
              name="guests"
              type="number"
              inputMode="numeric"
              min={1}
              max={30}
              label={t("guests")}
              hideLabel
              placeholder={t("guests")}
              icon={<Users />}
              className="md:w-48"
            />
          </>
        )}
        <Button type="submit" size="lg" fullWidth className="md:w-auto">
          {t("search")}
        </Button>
      </form>
    </div>
  );
}
```

`src/features/onboarding/constants.ts`:
```ts
export const ONBOARDED_COOKIE = "sr_onboarded";
```

`src/features/onboarding/components/OnboardingCarousel.tsx` (icon art stands in until the brand illustrations are exported to `public/brand/`):
```tsx
"use client";

import { Building2, Heart, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const SLIDES = [
  { title: "slide1", body: "slide1Body", Icon: Building2 },
  { title: "slide2", body: "slide2Body", Icon: MapPin },
  { title: "slide3", body: "slide3Body", Icon: Heart },
] as const;

export function OnboardingCarousel({ onFinish }: { onFinish: () => void }) {
  const t = useTranslations("Onboarding");
  const tCommon = useTranslations("Common");
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-between bg-surface px-6 py-12 text-center">
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="flex size-48 items-center justify-center rounded-full bg-primary-soft text-primary" aria-hidden="true">
          <slide.Icon className="size-24" strokeWidth={1.25} />
        </div>
        <h1 className="text-2xl font-semibold text-primary">{t(slide.title)}</h1>
        <p className="max-w-xs text-muted">{t(slide.body)}</p>
        <div className="flex gap-1.5" aria-hidden="true">
          {SLIDES.map((s, i) => (
            <span key={s.title} className={cn("h-1 w-6 rounded-full", i === index ? "bg-primary" : "bg-primary-soft")} />
          ))}
        </div>
        <span className="sr-only">{t("progress", { current: index + 1, total: SLIDES.length })}</span>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <Button size="lg" fullWidth onClick={() => (last ? onFinish() : setIndex(index + 1))}>
          {last ? t("getStarted") : tCommon("next")}
        </Button>
        {!last && (
          <Button variant="ghost" onClick={onFinish}>
            {tCommon("skip")}
          </Button>
        )}
      </div>
    </div>
  );
}
```

`src/features/onboarding/components/Welcome.tsx`:
```tsx
"use client";

import { useRouter } from "@/i18n/navigation";
import { ONBOARDED_COOKIE } from "../constants";
import { OnboardingCarousel } from "./OnboardingCarousel";

export function Welcome() {
  const router = useRouter();
  return (
    <OnboardingCarousel
      onFinish={() => {
        document.cookie = `${ONBOARDED_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
        router.replace("/");
      }}
    />
  );
}
```

`src/features/onboarding/components/OnboardingGate.tsx` (mobile-only first-run redirect; desktop visitors get the landing page):
```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { ONBOARDED_COOKIE } from "../constants";

export function OnboardingGate() {
  const router = useRouter();
  useEffect(() => {
    const done = document.cookie.split("; ").some((c) => c.startsWith(`${ONBOARDED_COOKIE}=`));
    if (!done && window.matchMedia("(max-width: 767px)").matches) router.replace("/welcome");
  }, [router]);
  return null;
}
```

`src/app/[locale]/welcome/page.tsx`:
```tsx
import { Welcome } from "@/features/onboarding/components/Welcome";

export default function WelcomePage() {
  return <Welcome />;
}
```

Replace `src/app/[locale]/(main)/page.tsx`:
```tsx
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LocaleSwitcher } from "@/components/shell/LocaleSwitcher";
import { PageContainer } from "@/components/ui/PageContainer";
import { OnboardingGate } from "@/features/onboarding/components/OnboardingGate";
import { HomeSearch } from "@/features/search/components/HomeSearch";

export default async function HomePage() {
  const t = await getTranslations("Home");
  return (
    <>
      <OnboardingGate />
      <section className="md:bg-primary md:bg-[radial-gradient(circle_at_20%_20%,#1f6fd1_0,transparent_50%),radial-gradient(circle_at_80%_80%,#003f86_0,transparent_45%)]">
        <PageContainer className="flex flex-col gap-8 pt-6 pb-10 md:items-center md:py-28">
          <div className="flex justify-end md:hidden">
            <Suspense>
              <LocaleSwitcher />
            </Suspense>
          </div>
          <h1 className="mt-16 text-3xl leading-tight md:mt-0 md:text-center md:text-5xl md:text-white">
            <span className="block font-bold">{t("titleTop")}</span>
            <span className="block">{t("titleBottom")}</span>
          </h1>
          <HomeSearch />
        </PageContainer>
      </section>
    </>
  );
}
```

`src/app/[locale]/(main)/search/page.tsx`:
```tsx
import { Building2, MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { parseSearchParams } from "@/features/search/params";

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = parseSearchParams(await searchParams);
  const t = await getTranslations("Search");
  const tHome = await getTranslations("Home");

  return (
    <PageContainer className="py-6">
      <div className="flex items-center gap-2 border-b border-line pb-3">
        <MapPin className="size-5" aria-hidden="true" />
        <h1 className="font-medium">{query.location ?? t("anywhere")}</h1>
        <span className="ml-auto rounded-full bg-surface px-3 py-1 text-xs">{query.mode === "short" ? tHome("short") : tHome("long")}</span>
      </div>
      <EmptyState icon={<Building2 />} title={t("emptyTitle")} body={t("emptyBody")} />
    </PageContainer>
  );
}
```

`src/app/icon.svg` (favicon: the logo mark on brand blue):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0057b8"/><g transform="translate(8 10) scale(.75)" fill="none" stroke="#dce6f5" stroke-width="5"><path d="M4 28 32 6l28 22"/><path d="M14 23v29h14v-9"/><path d="M23 26v12h18"/><path d="M41 26v26h9V23"/></g></svg>
```

`src/app/manifest.ts`:
```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Space Rental",
    short_name: "Space Rental",
    description: "Rent houses, lodges and apartments in Rwanda.",
    start_url: "/",
    display: "standalone",
    background_color: "#0057b8",
    theme_color: "#0057b8",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
```

Delete `src/app/favicon.ico`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm test:unit src/features/search src/features/onboarding && pnpm typecheck`
Expected: PASS (11 tests). Typecheck is clean.

- [ ] **Step 5: Visual check and commit**

Run `pnpm dev`. Then:
- **390px:** the first visit to `/en` goes to `/en/welcome`. "Skip" returns home, and reloading home stays home.
- **1440px:** you see the blue hero with the horizontal search bar.
- **Search:** submitting goes to `/en/search?...` with the empty state.
- **`/en/search?mode=zzz&guests=-1&checkIn=2026-02-31`:** the page renders normally.

```bash
pnpm lint
git add -A
git commit -m "feat(home): add home search, search page, mobile onboarding and manifest"
```

---
### Task 11: Security headers, observability and error pages

**Files:**
- Create: `src/lib/security-headers.ts`, `src/lib/security-headers.test.ts`, `src/instrumentation.ts`, `src/instrumentation-client.ts`, `src/app/[locale]/error.tsx`, `src/app/[locale]/not-found.tsx`
- Modify: `next.config.ts`

**Interfaces:**
- Produces: `securityHeaders(opts: { isProd: boolean }): { key: string; value: string }[]`. Sentry is a no-op unless `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` are set.

- [ ] **Step 1: Install**

```bash
pnpm add @sentry/nextjs@11.6.0
```

- [ ] **Step 2: Write the failing test**

`src/lib/security-headers.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { securityHeaders } from "./security-headers";

const asMap = (isProd: boolean) => Object.fromEntries(securityHeaders({ isProd }).map((h) => [h.key, h.value]));

describe("securityHeaders", () => {
  it("forbids framing, sniffing and leaking referrers", () => {
    const h = asMap(true);
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(h["Content-Security-Policy"]).toContain("object-src 'none'");
  });

  it("allows Cloudinary images", () => {
    expect(asMap(true)["Content-Security-Policy"]).toContain("img-src 'self' data: blob: https://res.cloudinary.com");
  });

  it("only sends HSTS and forbids eval in production", () => {
    expect(asMap(true)["Strict-Transport-Security"]).toMatch(/max-age=63072000/);
    expect(asMap(true)["Content-Security-Policy"]).not.toContain("'unsafe-eval'");
    expect(asMap(false)["Strict-Transport-Security"]).toBeUndefined();
    expect(asMap(false)["Content-Security-Policy"]).toContain("'unsafe-eval'");
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `pnpm test:unit src/lib/security-headers.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement**

`src/lib/security-headers.ts`:
```ts
export function securityHeaders({ isProd }: { isProd: boolean }): { key: string; value: string }[] {
  const csp = [
    "default-src 'self'",
    // Next.js injects inline bootstrap scripts; tighten to nonces in a later phase.
    `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://res.cloudinary.com",
    "font-src 'self'",
    "connect-src 'self' https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");

  const headers = [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  ];
  if (isProd) headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" });
  return headers;
}
```

Replace `next.config.ts`:
```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders({ isProd: process.env.NODE_ENV === "production" }) }];
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
```

`src/instrumentation.ts`:
```ts
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

export const onRequestError = Sentry.captureRequestError;
```

`src/instrumentation-client.ts`:
```ts
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, tracesSampleRate: 0.1, sendDefaultPii: false });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
```

`src/app/[locale]/error.tsx`:
```tsx
"use client";

import * as Sentry from "@sentry/nextjs";
import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("Errors");
  const tCommon = useTranslations("Common");

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <PageContainer className="py-16">
      <EmptyState icon={<TriangleAlert />} title={t("title")} body={t("body")} action={<Button onClick={reset}>{tCommon("tryAgain")}</Button>} />
    </PageContainer>
  );
}
```

`src/app/[locale]/not-found.tsx`:
```tsx
import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonClasses } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("Errors");
  const tCommon = await getTranslations("Common");
  return (
    <PageContainer className="py-16">
      <EmptyState
        icon={<SearchX />}
        title={t("notFoundTitle")}
        body={t("notFoundBody")}
        action={
          <Link href="/" className={buttonClasses()}>
            {tCommon("goHome")}
          </Link>
        }
      />
    </PageContainer>
  );
}
```

- [ ] **Step 5: Run the tests and a production build**

Run: `pnpm test:unit src/lib/security-headers.test.ts && pnpm build && pnpm start`
Then check:
- `curl -sI http://localhost:3000/en` shows `content-security-policy`, `x-frame-options: DENY` and `strict-transport-security`, and no `x-powered-by`.
- `curl -s http://localhost:3000/en/missing | grep -o "Page not found"` prints the match.

Stop the server afterwards.

- [ ] **Step 6: Commit**

```bash
pnpm lint && pnpm typecheck
git add -A
git commit -m "feat(platform): add security headers, Sentry hooks and localized error pages"
```

---

### Task 12: End-to-end tests and full CI

**Files:**
- Create: `playwright.config.ts`, `e2e/support/{mail.ts,flows.ts}`, `e2e/{shell,auth,profile,security}.spec.ts`
- Modify: `.github/workflows/ci.yml`, `package.json`

**Interfaces:**
- Consumes: the whole app. The E2E server runs against the **test** database through `scripts/with-test-db.ts`, with `MAIL_DRIVER=file`, `MAIL_OUTBOX_DIR=.e2e-mail` and `RATE_LIMIT_ENABLED=false`, on port 3100.
- Produces: `pnpm test:e2e`, and a CI that runs lint, typecheck, migrations, unit + integration tests, build and E2E on mobile (Pixel 7) and desktop (1440×900).

- [ ] **Step 1: Install Playwright**

```bash
pnpm add -D @playwright/test@1.64.0
pnpm exec playwright install chromium
pnpm pkg set scripts.test:e2e="playwright test"
```

- [ ] **Step 2: Config and support helpers**

`playwright.config.ts`:
```ts
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `tsx scripts/with-test-db.ts sh -c "pnpm build && pnpm start -p ${PORT}"`,
    url: `${baseURL}/en`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      BETTER_AUTH_URL: baseURL,
      MAIL_DRIVER: "file",
      MAIL_OUTBOX_DIR: ".e2e-mail",
      RATE_LIMIT_ENABLED: "false",
    },
  },
});
```

`e2e/support/mail.ts`:
```ts
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DIR = ".e2e-mail";

type StoredMail = { to: string; subject: string; text: string; html: string; sentAt: string };

export async function waitForMail(to: string, timeoutMs = 20_000): Promise<StoredMail> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const files = await readdir(DIR).catch(() => [] as string[]);
    const mails = await Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(DIR, f), "utf8")) as StoredMail));
    const mine = mails.filter((m) => m.to === to).sort((a, b) => a.sentAt.localeCompare(b.sentAt));
    if (mine.length) return mine[mine.length - 1];
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No email to ${to} within ${timeoutMs}ms`);
}

export function firstLink(text: string): string {
  const match = text.match(/https?:\/\/\S+/);
  if (!match) throw new Error("No link in email");
  return match[0];
}

export function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}
```

`e2e/support/flows.ts`:
```ts
import { expect, type Page } from "@playwright/test";
import { firstLink, uniqueEmail, waitForMail } from "./mail";

export const PASSWORD = "umuganda-blue-lake-42";

const BASE_URL = "http://localhost:3100";

export async function skipOnboarding(page: Page) {
  await page.context().addCookies([{ name: "sr_onboarded", value: "1", url: BASE_URL }]);
}

/** Signs up through the UI, follows the verification link and ends signed in. Returns the email. */
export async function signUpAndVerify(page: Page, name = "Alona Test"): Promise<string> {
  const email = uniqueEmail("user");
  await skipOnboarding(page);
  await page.goto("/en/signup");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/en\/check-email/);
  const mail = await waitForMail(email);
  await page.goto(firstLink(mail.text));
  await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
  return email;
}
```

- [ ] **Step 3: Write the E2E specs**

`e2e/shell.spec.ts`:
```ts
import { expect, test } from "@playwright/test";
import { skipOnboarding } from "./support/flows";

test("root redirects to the default locale", async ({ page }) => {
  await skipOnboarding(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole("heading", { name: /Find\s*your new home/ })).toBeVisible();
});

test("mobile uses the bottom tab bar, desktop the header", async ({ page }, testInfo) => {
  await skipOnboarding(page);
  await page.goto("/en");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  if (testInfo.project.name === "mobile") {
    await expect(nav.getByRole("link")).toHaveCount(5);
    await expect(page.getByRole("link", { name: "Log in" })).toBeHidden();
  } else {
    await expect(nav.getByRole("link")).toHaveCount(4);
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  }
});

test("language switcher translates the page", async ({ page }) => {
  await skipOnboarding(page);
  await page.goto("/en");
  await page.getByLabel("Language").filter({ visible: true }).selectOption("fr");
  await expect(page).toHaveURL(/\/fr$/);
  await expect(page.getByRole("heading", { name: /Trouvez\s*votre nouveau chez-vous/ })).toBeVisible();
});

test("language switcher keeps the query string (desktop header)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "the header switcher is desktop-only");
  await skipOnboarding(page);
  await page.goto("/en/search?mode=long&location=Kigali");
  await page.getByLabel("Language").filter({ visible: true }).selectOption("fr");
  await expect(page).toHaveURL(/\/fr\/search\?mode=long&location=Kigali/);
  await expect(page.getByText("À partir de 6 mois")).toBeVisible();
});

test("search with garbage params still renders", async ({ page }) => {
  await skipOnboarding(page);
  await page.goto("/en/search?mode=zzz&guests=-4&checkIn=2026-02-31");
  await expect(page.getByText("No places here yet")).toBeVisible();
});

test("first mobile visit shows onboarding once", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "onboarding is mobile-only");
  await page.goto("/en");
  await expect(page).toHaveURL(/\/en\/welcome/);
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page).toHaveURL(/\/en$/);
  await page.reload();
  await expect(page).toHaveURL(/\/en$/);
});
```

`e2e/auth.spec.ts`:
```ts
import { expect, test } from "@playwright/test";
import { PASSWORD, signUpAndVerify, skipOnboarding } from "./support/flows";
import { firstLink, waitForMail } from "./support/mail";

test("sign up → verify → signed in → sign out → log in", async ({ page }) => {
  const email = await signUpAndVerify(page);
  await page.goto("/en/profile");
  await expect(page.getByText(email).first()).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/en$/);

  await page.goto("/en/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/en$/);
});

test("wrong password shows a friendly error", async ({ page }) => {
  await skipOnboarding(page);
  await page.goto("/en/login");
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Wrong email or password.");
});

test("protected pages send you to login and back", async ({ page }) => {
  const email = await signUpAndVerify(page);
  await page.context().clearCookies();
  await skipOnboarding(page);

  await page.goto("/en/bookings");
  await expect(page).toHaveURL(/\/en\/login\?next=%2Fbookings/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/en\/bookings$/);
  await expect(page.getByText("No bookings yet")).toBeVisible();
});

test("an unsafe next parameter is ignored", async ({ page }) => {
  const email = await signUpAndVerify(page);
  await page.context().clearCookies();
  await skipOnboarding(page);
  await page.goto("/en/login?next=//evil.example");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/localhost:3100\/en$/);
});

test("forgot password → reset → log in with the new password", async ({ page }) => {
  const email = await signUpAndVerify(page);
  await page.context().clearCookies();
  await skipOnboarding(page);

  await page.goto("/en/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("reset link is on its way");

  await expect.poll(async () => (await waitForMail(email)).subject).toBe("Reset your Space Rental password");
  await page.goto(firstLink((await waitForMail(email)).text));
  await expect(page).toHaveURL(/\/en\/reset-password\?token=/);
  await page.getByLabel("New password").fill("new-river-kivu-77");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("status")).toHaveText("Password updated. You can now log in.");

  await page.goto("/en/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("new-river-kivu-77");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/en$/);
});
```

`e2e/profile.spec.ts`:
```ts
import { expect, test } from "@playwright/test";
import { signUpAndVerify } from "./support/flows";

test("edit name and phone, then switch language", async ({ page }) => {
  await signUpAndVerify(page);
  await page.goto("/en/profile");

  await page.getByLabel("Full name").fill("Alona Kotilevska");
  await page.getByLabel("Phone number").fill("0788 123 456");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");

  await page.reload();
  await expect(page.getByLabel("Full name")).toHaveValue("Alona Kotilevska");
  await expect(page.getByLabel("Phone number")).toHaveValue("+250788123456");

  await page.getByLabel("Phone number").fill("12");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByLabel("Phone number")).toHaveAccessibleDescription("Enter a valid phone number.");

  await page.getByLabel("Phone number").fill("");
  await page.getByRole("main").getByLabel("Language", { exact: true }).selectOption("fr");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/fr\/profile$/);
  await expect(page.getByRole("heading", { name: "Profil" })).toBeVisible();
});
```

`e2e/security.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("pages carry security headers", async ({ request }) => {
  const res = await request.get("/en");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("unknown pages return a localized 404", async ({ page }) => {
  const res = await page.goto("/fr/nexiste-pas");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Page introuvable")).toBeVisible();
});
```

- [ ] **Step 4: Run E2E locally**

```bash
pnpm db:test:migrate
pnpm test:e2e
```
Expected: all specs pass on both `mobile` and `desktop`. The onboarding test is skipped on desktop.

If a label locator is ambiguous, scope it with `filter({ visible: true })` or a `getByRole("main")` container rather than changing app copy.

- [ ] **Step 5: Full CI workflow**

Replace `.github/workflows/ci.yml`:
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: app
          POSTGRES_PASSWORD: app
          POSTGRES_DB: space_rental_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U app"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      DATABASE_URL: postgresql://app:app@localhost:5432/space_rental_test
      TEST_DATABASE_URL: postgresql://app:app@localhost:5432/space_rental_test
      BETTER_AUTH_SECRET: ci-only-secret-at-least-32-characters-long
      BETTER_AUTH_URL: http://localhost:3100
      MAIL_DRIVER: memory
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm db:test:migrate
      - run: pnpm test
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 6: Final verification and commit**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`
Expected: everything passes.

```bash
git add -A
git commit -m "test(e2e): add Playwright flows for shell, auth, profile and security; full CI"
```

---

## Phase 1 Done When

- `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` all pass locally and in CI.
- A new visitor on a phone sees onboarding, then the home search. A desktop visitor sees the hero with the horizontal search bar.
- A user can sign up, verify by email, log in, reset their password, edit their profile (including the language) and sign out, in en, rw or fr.
- No page renders hard-coded user-facing copy outside `messages/*.json`.

## Deferred to Later Phases (by design)

- "Become a host" and admin screens (Phase 2).
- Real search, date and guest pickers, the map and listings (Phase 3).
- Bookings, viewings, chat and reviews (Phases 4–5). Their tabs show empty states now.
- Swapping in the Figma logo and illustrations: drop the files into `public/brand/` and update `LogoMark` / `OnboardingCarousel`.
