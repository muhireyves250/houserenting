import type { ListingCardData } from "@/features/listings/service";
import type { SearchMode } from "@/features/search/params";
import { ListingCard } from "./ListingCard";

export function ListingGrid({ listings, mode }: { listings: ListingCardData[]; mode: SearchMode }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
      {listings.map((listing, index) => (
        <li key={listing.id} className="flex [&>a]:flex-1">
          <ListingCard listing={listing} mode={mode} priority={index < 2} />
        </li>
      ))}
    </ul>
  );
}
