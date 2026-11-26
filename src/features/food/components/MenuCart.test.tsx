import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { MenuCart } from "./MenuCart";

vi.mock("../actions", () => ({ placeOrderAction: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), Link: (p: { children: unknown }) => p.children }));

const menu = [
  { id: "d1", section: "Lunch", name: "Brochettes", description: "", price: 5_000, photoUrl: null },
  { id: "d2", section: "Lunch", name: "Isombe", description: "", price: 3_000, photoUrl: null },
];
const kitchen = { id: "stay", pickup: false, delivery: false, deliveryFee: 0, paused: false, atYourStay: true, prepMinutes: 20, minOrder: 0 };

describe("Order again", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("opens the order with exactly the same dishes, quantities and note, and says which dishes are gone", async () => {
    localStorage.setItem("sr_cart_stay", JSON.stringify({ d1: 2, d2: 1, gone: 1 }));
    sessionStorage.setItem("sr_again_stay", JSON.stringify({ dishes: 3, note: "No pepper" }));
    renderWithIntl(<MenuCart restaurant={kitchen} menu={menu} signedIn stay={{ reference: "VP-1", label: "Room 1", free: true }} defaultPhone="0788000000" checkoutPath="/food" single />);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Brochettes");
    expect(dialog).toHaveTextContent("Isombe");
    expect(dialog).toHaveTextContent(/13,000/); // 2 × 5,000 + 3,000
    expect(screen.getByDisplayValue("No pepper")).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/1 dish from that order is no longer on the menu/);
    expect(sessionStorage.getItem("sr_again_stay")).toBeNull(); // only once
  });

  it("just shows the menu when the cart wasn't from Order again", async () => {
    localStorage.setItem("sr_cart_stay", JSON.stringify({ d1: 1 }));
    renderWithIntl(<MenuCart restaurant={kitchen} menu={menu} signedIn stay={{ reference: "VP-1", label: "Room 1", free: true }} defaultPhone="0788000000" checkoutPath="/food" single />);
    expect(await screen.findByText(/View order|Your order/i)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
