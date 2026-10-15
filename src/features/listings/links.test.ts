import { describe, expect, it } from "vitest";
import { listingIdCandidates, listingPath, slugify } from "./links";

describe("permanent listing links", () => {
  it("make readable words from a title", () => {
    expect(slugify("Sunny Studio, Kimihurura!")).toBe("sunny-studio-kimihurura");
    expect(slugify("Maison à Musanze — vue volcans")).toBe("maison-a-musanze-vue-volcans");
    expect(slugify("!!!")).toBe("");
  });

  it("put the ID first so the link keeps working when the title changes", () => {
    const path = listingPath("clx9abc123", "Sunny studio");
    expect(path).toBe("/listings/clx9abc123-sunny-studio");
    expect(listingIdCandidates(path.split("/")[2]!)).toContain("clx9abc123");
    expect(listingIdCandidates("clx9abc123-an-old-title")).toEqual(["clx9abc123-an-old-title", "clx9abc123-an-old", "clx9abc123-an", "clx9abc123"]);
    expect(listingIdCandidates("clx9abc123")).toEqual(["clx9abc123"]);
    expect(listingPath("clx9abc123", "!!!")).toBe("/listings/clx9abc123");
  });
});

describe("IDs that contain dashes", () => {
  it("still offer the whole ID as a candidate", () => {
    expect(listingIdCandidates("seed-karongi-cottage")).toContain("seed-karongi-cottage");
    expect(listingIdCandidates("seed-karongi-cottage-lakeside-cottage")).toContain("seed-karongi-cottage");
  });
});
