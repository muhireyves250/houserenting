import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { resetSearchState, useSearchState } from "@/features/search/search-store";
import { SearchStateSync } from "./SearchStateSync";

function Probe() {
  const [{ mode, location, range, guests }] = useSearchState();
  return <output>{JSON.stringify({ mode, location, range, guests })}</output>;
}

beforeEach(() => resetSearchState());

describe("SearchStateSync", () => {
  it("copies the URL search into the shared store", () => {
    render(
      <>
        <SearchStateSync query={{ mode: "short", location: "Kigali", checkIn: "2026-10-20", checkOut: "2026-10-23", guests: 2, pets: 1 }} />
        <Probe />
      </>,
    );
    expect(JSON.parse(screen.getByRole("status").textContent ?? "{}")).toEqual({
      mode: "short",
      location: "Kigali",
      range: { checkIn: "2026-10-20", checkOut: "2026-10-23" },
      guests: { adults: 2, children: 0, pets: 1 },
    });
  });
});
