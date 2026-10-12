import { describe, expect, it } from "vitest";
import { icuArguments } from "./icu-args";

describe("icuArguments", () => {
  it("finds simple arguments", () => {
    expect(icuArguments("Hello {name}, step {current} of {total}")).toEqual(["current", "name", "total"]);
  });

  it("finds plural and select arguments, not their option bodies", () => {
    expect(icuArguments("{count, plural, one {# room} other {# rooms}}")).toEqual(["count"]);
    expect(icuArguments("{ months , plural, one {Deposit # month} other {Deposit # months}}")).toEqual(["months"]);
  });

  it("detects a renamed plural argument", () => {
    expect(icuArguments("{n, plural, one {#} other {#}}")).not.toEqual(icuArguments("{count, plural, one {#} other {#}}"));
  });

  it("returns an empty list for plain text", () => {
    expect(icuArguments("No arguments here")).toEqual([]);
  });
});
