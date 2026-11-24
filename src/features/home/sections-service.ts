import "server-only";
import { audit } from "@/features/audit/service";
import { CARD_SELECT, type ListingCardData } from "@/features/listings/service";
import { PLACE_TYPES } from "@/features/search/params";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { canStaff } from "@/lib/roles";


const ROW_LIMIT = 10;
const SHORT_UNITS = ["HOUR", "DAY", "NIGHT", "WEEK"] as const;
const LONG_UNITS = ["MONTH", "YEAR"] as const;
/** Bookings that count for Hot deals: paid ones in the last 90 days. */
const HOT_DAYS = 90;

export type HomeRow = { id: string; kind: "CUSTOM" | "HOT_DEALS"; title: string; subtitle: string; mode: "short" | "long"; query: Record<string, string>; listings: ListingCardData[] };

/** Published houses by id, in the order given. */
async function cardsInOrder(ids: string[], where: Prisma.ListingWhereInput = {}): Promise<ListingCardData[]> {
  if (ids.length === 0) return [];
  const rows = await db.listing.findMany({ where: { ...where, id: { in: ids }, status: "PUBLISHED" }, select: CARD_SELECT });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/**
 * The home page's rows, as VIIPA set them (order, titles, which houses). Each shows its picked houses first, then:
 * Hot deals the most booked houses lately; any other row the houses in its towns, of its kinds and stay length.
 * `only` narrows every row to the kinds of place the guest chose (the switch or a category chip).
 */
export async function homeRows(only: readonly string[] | null = null, now: Date = new Date()): Promise<HomeRow[]> {
  const sections = await db.homeSection.findMany({ where: { active: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  const rows: HomeRow[] = [];
  for (const s of sections) {
    const mode = s.mode === "long" ? "long" : "short";
    const types = (only ? (s.types.length ? s.types.filter((t) => only.includes(t)) : [...only]) : s.types).filter((t) => (PLACE_TYPES as readonly string[]).includes(t));
    if (only && s.types.length && types.length === 0) continue;
    const where: Prisma.ListingWhereInput = {
      status: "PUBLISHED",
      ...(types.length ? { type: { in: types as (typeof PLACE_TYPES)[number][] } } : {}),
      rates: { some: { unit: { in: mode === "long" ? [...LONG_UNITS] : [...SHORT_UNITS] } } },
    };
    const picked = await cardsInOrder(s.houseIds, where);
    let rest: ListingCardData[] = [];
    if (s.kind === "HOT_DEALS") {
      const booked = await db.booking.groupBy({
        by: ["listingId"],
        where: { status: { in: ["CONFIRMED", "CHECKED_IN", "COMPLETED"] }, createdAt: { gte: new Date(now.getTime() - HOT_DAYS * 86_400_000) } },
        _count: { listingId: true },
        orderBy: { _count: { listingId: "desc" } },
        take: 30,
      });
      rest = await cardsInOrder(booked.map((b) => b.listingId), where);
    } else {
      const places = s.places.map((p) => p.trim()).filter(Boolean);
      rest = await db.listing.findMany({
        where: { ...where, ...(places.length ? { OR: places.flatMap((p) => [{ city: { equals: p, mode: "insensitive" as const } }, { district: { equals: p, mode: "insensitive" as const } }]) } : {}), id: { notIn: s.houseIds } },
        select: CARD_SELECT,
        orderBy: [{ ratingAvg: "desc" }, { publishedAt: "desc" }],
        take: ROW_LIMIT,
      });
    }
    const seen = new Set<string>();
    const listings = [...picked, ...rest].filter((l) => !seen.has(l.id) && seen.add(l.id)).slice(0, ROW_LIMIT);
    if (listings.length === 0) continue;
    const query: Record<string, string> = { mode, ...(s.places[0] ? { location: s.places[0] } : {}), ...(types.length ? { type: types.join(",") } : {}) };
    rows.push({ id: s.id, kind: s.kind, title: s.title, subtitle: s.subtitle, mode, query, listings });
  }
  return rows;
}

// ——— Staff: managing the rows ———

type Actor = { id: string; role?: string | null; staffAreas?: readonly string[] | null };
export type SectionInput = { title: string; subtitle: string; places: string[]; types: string[]; mode: "short" | "long"; houseIds: string[]; active: boolean };

const clean = (raw: SectionInput): SectionInput | null => {
  const title = String(raw.title ?? "").trim().slice(0, 80);
  if (title.length < 2) return null;
  return {
    title,
    subtitle: String(raw.subtitle ?? "").trim().slice(0, 120),
    places: [...new Set((raw.places ?? []).map((p) => String(p).trim()).filter(Boolean))].slice(0, 10),
    types: (raw.types ?? []).filter((t) => (PLACE_TYPES as readonly string[]).includes(t)),
    mode: raw.mode === "long" ? "long" : "short",
    houseIds: [...new Set((raw.houseIds ?? []).filter((id) => typeof id === "string" && id.length <= 64))].slice(0, 20),
    active: raw.active !== false,
  };
};

/** Staff: every row (on or off) with its picked houses' names, in page order. */
export async function sectionsForStaff() {
  const sections = await db.homeSection.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  const ids = [...new Set(sections.flatMap((s) => s.houseIds))];
  const houses = ids.length ? await db.listing.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, city: true } }) : [];
  const byId = new Map(houses.map((h) => [h.id, h]));
  return sections.map((s) => ({ ...s, houses: s.houseIds.flatMap((id) => byId.get(id) ?? []) }));
}

/** Staff add a row (at the end) or change one. Logged. */
export async function saveSection(actor: Actor, id: string | null, raw: SectionInput): Promise<{ ok: true; id: string } | { ok: false; error: "notAllowed" | "invalid" | "notFound" }> {
  if (!canStaff(actor, "listings")) return { ok: false, error: "notAllowed" };
  const input = clean(raw);
  if (!input) return { ok: false, error: "invalid" };
  if (id) {
    const { count } = await db.homeSection.updateMany({ where: { id }, data: input });
    if (count !== 1) return { ok: false, error: "notFound" };
  } else {
    const last = await db.homeSection.aggregate({ _max: { position: true } });
    id = (await db.homeSection.create({ data: { ...input, position: (last._max.position ?? 0) + 1 } })).id;
  }
  await audit(db, { actorId: actor.id, action: "home.section", entityType: "homeSection", entityId: id, data: { title: input.title } });
  return { ok: true, id };
}

/** Staff move a row up or down the page. */
export async function moveSection(actor: Actor, id: string, direction: "up" | "down"): Promise<boolean> {
  if (!canStaff(actor, "listings")) return false;
  const all = await db.homeSection.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const i = all.findIndex((s) => s.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= all.length) return false;
  [all[i], all[j]] = [all[j]!, all[i]!];
  await db.$transaction(all.map((s, position) => db.homeSection.update({ where: { id: s.id }, data: { position } })));
  return true;
}

/** Staff remove a row (Hot deals stays: it can only be turned off). */
export async function deleteSection(actor: Actor, id: string): Promise<boolean> {
  if (!canStaff(actor, "listings")) return false;
  const { count } = await db.homeSection.deleteMany({ where: { id, kind: "CUSTOM" } });
  if (count === 1) await audit(db, { actorId: actor.id, action: "home.sectionDelete", entityType: "homeSection", entityId: id });
  return count === 1;
}

/** Live houses staff can pick for a row (by name or town). */
export function pickableHouses(q = "", take = 30) {
  const text = q.trim().slice(0, 60);
  return db.listing.findMany({
    where: { status: "PUBLISHED", ...(text ? { OR: [{ title: { contains: text, mode: "insensitive" } }, { city: { contains: text, mode: "insensitive" } }, { district: { contains: text, mode: "insensitive" } }] } : {}) },
    orderBy: { title: "asc" },
    take,
    select: { id: true, title: true, city: true },
  });
}
