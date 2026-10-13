import { beforeEach, describe, expect, it } from "vitest";
import { addRecent, readRecent, rememberView, type RecentListing } from "./recently-viewed";

const item = (id: string): RecentListing => ({ id, title: `Home ${id}`, type: "ROOM", city: "Kigali", photo: null, ratingAvg: 4.5, ratingCount: 3 });

describe("addRecent", () => {
  it("puts the newest first, without duplicates, capped", () => {
    expect(addRecent([item("a"), item("b")], item("b")).map((r) => r.id)).toEqual(["b", "a"]);
    const many = Array.from({ length: 12 }, (_, i) => item(String(i)));
    const next = addRecent(many, item("new"));
    expect(next).toHaveLength(12);
    expect(next[0]!.id).toBe("new");
    expect(next.at(-1)!.id).toBe("10");
  });
});

describe("storage", () => {
  beforeEach(() => localStorage.clear());

  it("remembers views across reads and ignores corrupt data", () => {
    rememberView(item("a"));
    rememberView(item("b"));
    expect(readRecent().map((r) => r.id)).toEqual(["b", "a"]);
    localStorage.setItem("sr_recent", "{not json");
    expect(readRecent()).toEqual([]);
    localStorage.setItem("sr_recent", JSON.stringify([{ nope: 1 }, item("c")]));
    expect(readRecent().map((r) => r.id)).toEqual(["c"]);
  });
});
