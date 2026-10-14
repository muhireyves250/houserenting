import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { signParams } = await import("./cloudinary");

describe("signParams", () => {
  it("matches Cloudinary's documented example", () => {
    // From Cloudinary's "Generating authentication signatures" guide.
    expect(signParams({ eager: "w_400,h_300,c_pad|w_260,h_200,c_crop", public_id: "sample_image", timestamp: 1315060510 }, "abcd")).toBe(
      "bfd09f95f331f558cbd1320e67aa8d488770583e",
    );
  });
});
