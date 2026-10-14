import { beforeEach, describe, expect, it } from "vitest";
import { forgetAccount, maskEmail, readRemembered, rememberAccount } from "./remembered";

describe("maskEmail", () => {
  it("keeps the first and last letters of the name part", () => {
    expect(maskEmail("muhireyves007@gmail.com")).toBe("m***7@gmail.com");
    expect(maskEmail("ab@x.rw")).toBe("a***b@x.rw");
    expect(maskEmail("a@x.rw")).toBe("a***@x.rw");
  });
});

describe("remembered account", () => {
  beforeEach(() => localStorage.clear());

  it("remembers the last account on this device and forgets it on request", () => {
    expect(readRemembered()).toBeNull();
    rememberAccount({ name: "Sabrina Ghilaci", email: "host@spacerental.rw" });
    expect(readRemembered()).toEqual({ name: "Sabrina Ghilaci", email: "host@spacerental.rw" });
    forgetAccount();
    expect(readRemembered()).toBeNull();
  });

  it("ignores corrupt data", () => {
    localStorage.setItem("sr_last_account", "{nope");
    expect(readRemembered()).toBeNull();
    localStorage.setItem("sr_last_account", JSON.stringify({ name: 1 }));
    expect(readRemembered()).toBeNull();
  });
});
