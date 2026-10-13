"use client";

import { useEffect } from "react";
import type { SearchQuery } from "@/features/search/params";
import { useSearchState } from "@/features/search/search-store";

/** Results page: mirrors the URL's search into the shared store, so the header search shows (and edits) it. */
export function SearchStateSync({ query }: { query: SearchQuery }) {
  const [, setSearch] = useSearchState();
  const { mode, location = "", checkIn, checkOut, guests = 0, pets = 0, flex = 0 } = query;
  useEffect(() => {
    setSearch({ mode, location, range: { checkIn, checkOut }, flex, guests: { adults: guests, children: 0, pets } });
  }, [setSearch, mode, location, checkIn, checkOut, guests, pets, flex]);
  return null;
}
