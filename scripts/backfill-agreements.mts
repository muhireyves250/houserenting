/**
 * One-off: gives every place, laundry and restaurant that has no commission agreement one at the rate it uses today
 * (its own rate, else its category's, else the platform's), so removing the platform-wide default changes nothing.
 * Safe to run again: anything that already has an agreement is left alone.
 */
import "dotenv/config";
import { feesFor } from "@/features/bookings/money";
import { readSettings } from "@/features/settings/service";
import { db } from "@/lib/db";

const FROM = new Date("2026-01-01T00:00:00+02:00");
const NOTE = "Carried over from the earlier default rate";

const settings = await readSettings();
const admin = await db.user.findFirst({ where: { role: { in: ["SUPER_ADMIN", "ADMIN"] } }, orderBy: { createdAt: "asc" }, select: { id: true } });
if (!admin) throw new Error("no admin account");
const has = new Set((await db.commissionAgreement.findMany({ select: { subject: true, subjectId: true } })).map((a) => `${a.subject}:${a.subjectId}`));
const rows: { subject: "PLACE" | "RESTAURANT" | "LAUNDRY"; subjectId: string; percentBps: number }[] = [];
for (const l of await db.listing.findMany({ select: { id: true, type: true, commissionBps: true, laundryPricePerKg: true } })) {
  const bps = feesFor(settings, l.type, l.commissionBps).commissionBps ?? 0;
  if (!has.has(`PLACE:${l.id}`)) rows.push({ subject: "PLACE", subjectId: l.id, percentBps: bps });
  if (l.laundryPricePerKg !== null && !has.has(`LAUNDRY:${l.id}`)) rows.push({ subject: "LAUNDRY", subjectId: l.id, percentBps: bps });
}
for (const r of await db.restaurant.findMany({ select: { id: true } })) {
  if (!has.has(`RESTAURANT:${r.id}`)) rows.push({ subject: "RESTAURANT", subjectId: r.id, percentBps: settings.commissionBps ?? 0 });
}
// DRY_RUN=1: only say what would be created.
if (process.env.DRY_RUN) {
  console.log(`would create: ${rows.length}`, JSON.stringify(rows.map((r) => [r.subject, r.percentBps])));
  process.exit(0);
}
if (rows.length) await db.commissionAgreement.createMany({ data: rows.map((r) => ({ ...r, effectiveFrom: FROM, note: NOTE, createdById: admin.id })) });
console.log(`agreements created: ${rows.length}`);
process.exit(0);
