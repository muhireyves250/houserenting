import { chromium } from "@playwright/test";
const S = "/tmp/claude-1000/-home-ebenezer-Projects-house/d3e85b4a-46ea-4d80-8020-c1a08bbb22d2/scratchpad/prod", base = "https://houserenting-3qk3-nu.vercel.app";
const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
const errors = [];
async function ctxFor(viewport = { width: 1280, height: 1000 }) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addCookies([{ name: "sr_skip_welcome", value: "1", url: base }]);
  return ctx;
}
function watch(page, label) {
  page.on("pageerror", (e) => errors.push(label + " pageerror: " + e.message.slice(0, 150)));
  page.on("response", (r) => r.status() >= 500 && errors.push(label + " " + r.status() + " " + r.url()));
}
async function visit(page, path, shot) {
  const r = await page.goto(base + path, { timeout: 90000 });
  await page.waitForTimeout(2500);
  if (shot) await page.screenshot({ path: S + "/" + shot + ".png", timeout: 60000 }).catch(() => {});
  console.log("page", path, r?.status());
}
// Guest
const guestCtx = await ctxFor({ width: 390, height: 844 });
const email = "live-check-" + Date.now() + "@example.com";
const su = await guestCtx.request.post(base + "/api/auth/sign-up/email", { data: { name: "Live Check", email, password: "Live-check-12345" }, headers: { origin: base } });
console.log("signup", su.status());
const g = await guestCtx.newPage(); watch(g, "guest");
await visit(g, "/en", "home");
await visit(g, "/en/search?mode=short&beds=2&amenities=WIFI", "search");
await visit(g, "/en/listings/seed-karongi-cottage", "listing");
await g.getByRole("button", { name: "Share" }).first().click();
await g.getByRole("button", { name: "QR code" }).click();
console.log("qr", await g.getByRole("img", { name: /QR code for/ }).isVisible());
await g.keyboard.press("Escape");
// Book 2 nights a month ahead.
await g.locator("#stay-calendar").scrollIntoViewIfNeeded();
await g.getByRole("button", { name: "Next month" }).first().click().catch(() => {});
const days = g.locator('#stay-calendar button[data-date]:not(:disabled)');
const first = await days.nth(10).getAttribute("data-date");
await days.nth(10).click(); await days.nth(12).click();
console.log("dates from", first);
await g.getByRole("button", { name: "Reserve" }).last().click();
const dialog = g.getByRole("dialog");
await dialog.getByLabel("Mobile money number").fill("0788123456");
await dialog.getByRole("button", { name: "Next" }).click();
await dialog.getByRole("button", { name: "Book and hold these dates" }).click();
await g.waitForURL(/\/bookings\/SR-/, { timeout: 90000 });
const ref = g.url().split("/").pop();
await g.waitForTimeout(2000);
await g.screenshot({ path: S + "/booking.png", fullPage: true, timeout: 60000 }).catch(() => {});
console.log("booked", ref, "pay card:", await g.getByText("Pay to confirm").isVisible());
await visit(g, "/en/bookings", "bookings");
await visit(g, "/en/profile", "profile");
await visit(g, "/en/support", "support");
await visit(g, "/en/notifications", "notifications");
// Cancel the test booking so the dates are free again.
await g.goto(base + "/en/bookings/" + ref, { timeout: 90000 });
await g.getByRole("button", { name: "Cancel booking" }).click();
await g.getByRole("dialog").getByRole("button", { name: "Cancel booking" }).click();
await g.getByText("Cancelled").first().waitFor({ timeout: 60000 });
console.log("cancelled", ref);
// Staff / host
const hostCtx = await ctxFor();
const si = await hostCtx.request.post(base + "/api/auth/sign-in/email", { data: { email: "host@spacerental.rw", password: process.env.DEMO_HOST_PASSWORD }, headers: { origin: base } });
console.log("host signin", si.status());
const h = await hostCtx.newPage(); watch(h, "host");
for (const [path, shot] of [["/en/host", "host"], ["/en/host/listings/new", "host-new"], ["/en/admin", "admin"], ["/en/admin/moderation"], ["/en/admin/support"], ["/en/admin/bookings", "admin-bookings"], ["/en/admin/money", "admin-money"], ["/en/admin/promotions"], ["/en/admin/settings", "admin-settings"], ["/en/admin/users"], ["/en/admin/audit", "admin-audit"]]) {
  await visit(h, path, shot);
}
console.log("ERRORS", errors.length ? errors.join("\n") : "none");
await browser.close();
