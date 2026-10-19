import { describe, expect, it } from "vitest";
import { distanceKm, nextOrderSteps, priceCart } from "./rules";

describe("nextOrderSteps", () => {
  it("lets the kitchen take an order through to ready, and hand over pickups", () => {
    expect(nextOrderSteps("PLACED", "PICKUP", "kitchen")).toEqual(["ACCEPTED", "CANCELLED"]);
    expect(nextOrderSteps("PREPARING", "PICKUP", "kitchen")).toEqual(["READY"]);
    expect(nextOrderSteps("READY", "PICKUP", "kitchen")).toEqual(["DELIVERED"]);
    expect(nextOrderSteps("READY", "DELIVERY", "kitchen")).toEqual(["OUT_FOR_DELIVERY"]);
  });

  it("couriers only move deliveries; customers only cancel before acceptance", () => {
    expect(nextOrderSteps("READY", "DELIVERY", "courier")).toEqual(["OUT_FOR_DELIVERY"]);
    expect(nextOrderSteps("OUT_FOR_DELIVERY", "DELIVERY", "courier")).toEqual(["DELIVERED"]);
    expect(nextOrderSteps("READY", "PICKUP", "courier")).toEqual([]);
    expect(nextOrderSteps("PLACED", "DELIVERY", "customer")).toEqual(["CANCELLED"]);
    expect(nextOrderSteps("ACCEPTED", "DELIVERY", "customer")).toEqual([]);
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
