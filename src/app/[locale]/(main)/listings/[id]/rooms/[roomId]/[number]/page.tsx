import { notFound } from "next/navigation";
import { getPublishedListingByParam } from "@/features/listings/service";
import { listingIdCandidates } from "@/features/listings/links";
import { parseAgain } from "@/features/bookings/again";
import { RoomBookingView } from "@/features/rooms/components/RoomBookingView";

type Props = { params: Promise<{ id: string; roomId: string; number: string }>; searchParams?: Promise<{ again?: string | string[] }> };

/** One room of a lodge (a numbered room of a room type): everything about it, its calendar and Reserve. */
export default async function RoomPage({ params, searchParams }: Props) {
  const { id, roomId, number } = await params;
  const listing = await getPublishedListingByParam(listingIdCandidates(id));
  if (!listing) notFound();
  return <RoomBookingView listingId={listing.id} roomId={roomId} number={decodeURIComponent(number)} again={parseAgain((await searchParams)?.again)} />;
}
