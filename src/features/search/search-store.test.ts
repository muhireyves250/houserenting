import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { resetSearchState, useSearchState } from "./search-store";

describe("search store", () => {
  beforeEach(() => resetSearchState());

  it("starts empty in short-term mode", () => {
    const { result } = renderHook(() => useSearchState());
    expect(result.current[0]).toEqual({ mode: "short", location: "", range: {}, flex: 0, guests: { adults: 0, children: 0, pets: 0 }, openRequest: null });
  });

  it("shares updates between every component that uses it", () => {
    const a = renderHook(() => useSearchState());
    const b = renderHook(() => useSearchState());
    act(() => a.result.current[1]({ location: "Kigali", flex: 2 }));
    expect(b.result.current[0].location).toBe("Kigali");
    expect(b.result.current[0].flex).toBe(2);
    expect(b.result.current[0].mode).toBe("short");
  });
});
