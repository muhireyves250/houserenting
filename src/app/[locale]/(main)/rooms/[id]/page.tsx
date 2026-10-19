import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { listingPath } from "@/features/listings/links";
import { redirect } from "@/i18n/navigation";
import { db } from "@/lib/db";

type Props = { params: Promise<{ id: string }> };

/**
 * A room's permanent link (for QR codes and sharing): opens its place with the room chosen. The place's page
 * shows its own status (hidden, paused...) so the link never breaks or shows private details.
 */
export default async function RoomLinkPage({ params }: Props) {
  const { id } = await params;
  const room = await db.room.findUnique({ where: { id }, select: { id: true, listing: { select: { id: true, title: true } } } });
  if (!room) notFound();
  redirect({ href: { pathname: listingPath(room.listing.id, room.listing.title), query: { room: room.id } }, locale: await getLocale() });
}
