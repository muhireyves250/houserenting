import "server-only";
import { CARD_SELECT, type ListingCardData } from "@/features/listings/service";
import { db } from "@/lib/db";

/** Saves or un-saves a published listing for the user. Returns true when it is now saved. */
export async function toggleFavorite(userId: string, listingId: string): Promise<boolean> {
  const listing = await db.listing.findFirst({ where: { id: listingId, status: "PUBLISHED" }, select: { id: true } });
  if (!listing) throw new Error("Listing not found");

  const key = { userId_listingId: { userId, listingId } };
  const existing = await db.favorite.findUnique({ where: key });
  if (existing) {
    await db.favorite.delete({ where: key });
    return false;
  }
  // upsert tolerates a double click racing the first save.
  await db.favorite.upsert({ where: key, create: { userId, listingId }, update: {} });
  return true;
}

/** Which of the given listings this user has saved. */
export async function savedListingIds(userId: string, listingIds: string[]): Promise<Set<string>> {
  if (listingIds.length === 0) return new Set();
  const rows = await db.favorite.findMany({ where: { userId, listingId: { in: listingIds } }, select: { listingId: true } });
  return new Set(rows.map((r) => r.listingId));
}

/** The user's saved homes that are still published, most recently saved first. */
export async function listFavorites(userId: string): Promise<ListingCardData[]> {
  const rows = await db.favorite.findMany({
    where: { userId, listing: { status: "PUBLISHED" } },
    orderBy: { createdAt: "desc" },
    select: { listing: { select: CARD_SELECT } },
  });
  return rows.map((r) => r.listing);
}
