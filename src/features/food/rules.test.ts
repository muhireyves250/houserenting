import { describe, expect, it } from "vitest";
import { distanceKm, nextOrderSteps, priceCart } from "./rules";

describe("nextOrderSteps", () => {
  it("the restaurant confirms or rejects first; the guest pays; then the kitchen prepares and assigns a delivery person", () => {
    expect(nextOrderSteps("PLACED", "TO_STAY", "kitchen")).toEqual(["ACCEPTED", "REJECTED"]);
    // Confirmed but not paid: the kitchen waits (it can only cancel).
    expect(nextOrderSteps("ACCEPTED", "TO_STAY", "kitchen", false)).toEqual(["CANCELLED"]);
    expect(nextOrderSteps("PAID", "TO_STAY", "kitchen", true)).toEqual(["PREPARING"]);
    expect(nextOrderSteps("PREPARING", "TO_STAY", "kitchen", true)).toEqual(["READY"]);
    expect(nextOrderSteps("READY", "TO_STAY", "kitchen", true)).toEqual(["COURIER_ASSIGNED"]);
    // The restaurant answers for its delivery, so its kitchen can do the delivery steps too.
    expect(nextOrderSteps("COURIER_ASSIGNED", "TO_STAY", "kitchen", true)).toEqual(["OUT_FOR_DELIVERY"]);
  });

  it("delivery people collect and deliver (or report a failed delivery); the guest cancels only before paying", () => {
    expect(nextOrderSteps("COURIER_ASSIGNED", "TO_STAY", "courier", true)).toEqual(["OUT_FOR_DELIVERY"]);
    expect(nextOrderSteps("OUT_FOR_DELIVERY", "TO_STAY", "courier", true)).toEqual(["DELIVERED", "READY"]);
    expect(nextOrderSteps("READY", "TO_STAY", "courier", true)).toEqual([]);
    expect(nextOrderSteps("PLACED", "TO_STAY", "customer")).toEqual(["CANCELLED"]);
    expect(nextOrderSteps("ACCEPTED", "TO_STAY", "customer", false)).toEqual(["CANCELLED"]);
    expect(nextOrderSteps("PAID", "TO_STAY", "customer", true)).toEqual([]);
    expect(nextOrderSteps("OUT_FOR_DELIVERY", "TO_STAY", "customer", true)).toEqual(["DELIVERED"]);
    expect(nextOrderSteps("TIMED_OUT", "TO_STAY", "kitchen")).toEqual([]);
  });
});

describe("priceCart", () => {
  const menu = [
    { id: "a", name: "Brochette", price: 3000, available: true },
    { id: "b", name: "Fanta", price: 1000, available: false },
  ];
  it("prices from the menu and merges repeated items", () => {
    expect(priceCart([{ menuItemId: "a", quantity: 2 }, { menuItemId: "a", quantity: 1 }], menu)).toEqual({ items: [{ menuItemId: "a", name: "Brochette", price: 3000, quantity: 3 }], subtotal: 9000 });
  });
  it("refuses unknown or unavailable items and bad quantities", () => {
    expect(priceCart([{ menuItemId: "b", quantity: 1 }], menu)).toBeNull();
    expect(priceCart([{ menuItemId: "x", quantity: 1 }], menu)).toBeNull();
    expect(priceCart([{ menuItemId: "a", quantity: 0 }], menu)).toBeNull();
    expect(priceCart([], menu)).toBeNull();
  });
});

describe("distanceKm", () => {
  it("measures Kigali to Gisenyi at about 100 km", () => {
    const km = distanceKm({ lat: -1.9441, lng: 30.0619 }, { lat: -1.7, lng: 29.26 });
    expect(km).toBeGreaterThan(85);
    expect(km).toBeLessThan(100);
  });
});
