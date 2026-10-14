import { describe, expect, it } from "vitest";
import { listingIdFromParam, listingPath, slugify } from "./links";

describe("permanent listing links", () => {
  it("make readable words from a title", () => {
    expect(slugify("Sunny Studio, Kimihurura!")).toBe("sunny-studio-kimihurura");
    expect(slugify("Maison à Musanze — vue volcans")).toBe("maison-a-musanze-vue-volcans");
    expect(slugify("!!!")).toBe("");
  });

  it("put the ID first so the link keeps working when the title changes", () => {
    const path = listingPath("clx9abc123", "Sunny studio");
    expect(path).toBe("/listings/clx9abc123-sunny-studio");
    expect(listingIdFromParam(path.split("/")[2]!)).toBe("clx9abc123");
    expect(listingIdFromParam("clx9abc123-an-old-title")).toBe("clx9abc123");
    expect(listingIdFromParam("clx9abc123")).toBe("clx9abc123");
    expect(listingPath("clx9abc123", "!!!")).toBe("/listings/clx9abc123");
  });
});
