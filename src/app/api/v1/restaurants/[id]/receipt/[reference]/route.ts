import { createTranslator } from "next-intl";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { moneyPdf } from "@/features/food/money-pdf";
import { canRestaurant, restaurantRole } from "@/features/food/service";
import { catalogs } from "@/i18n/messages";
import { toAppLocale } from "@/i18n/routing";
import { db } from "@/lib/db";
import { formatRWF } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";

/** One paid order's receipt for the restaurant (its dishes, what the guest paid, VIIPA's commission and its share). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; reference: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id, reference } = await params;
  if (!/^OR-[A-Z0-9]{4,12}$/.test(reference) || !canRestaurant(await restaurantRole(user, id), "money")) return new Response("Not found", { status: 404 });
  const order = await db.foodOrder.findFirst({
    where: { reference, restaurantId: id, paidAt: { not: null } },
    select: { reference: true, paidAt: true, total: true, address: true, customer: { select: { name: true } }, restaurant: { select: { name: true } }, items: { select: { name: true, quantity: true, price: true } } },
  });
  if (!order) return new Response("Not found", { status: 404 });
  const ledger = await db.ledgerEntry.findMany({ where: { note: `food ${reference}`, kind: { in: ["COMMISSION", "HOST_PAYABLE"] } }, select: { kind: true, amount: true } });
  const commission = ledger.filter((e) => e.kind === "COMMISSION").reduce((n, e) => n + e.amount, 0);
  const share = ledger.filter((e) => e.kind === "HOST_PAYABLE").reduce((n, e) => n + e.amount, 0) || order.total - commission;
  const locale = toAppLocale(new URL(request.url).searchParams.get("lang"));
  const t = createTranslator({ locale, messages: catalogs[locale], namespace: "Food.money" });
  const rwf = (n: number) => formatRWF(n, locale);
  const pdf = await moneyPdf(
    {
      title: t("receiptTitle"),
      meta: [order.restaurant.name, t("receiptOrder", { reference }), t("receiptPaid", { when: formatKigaliDateTime(locale, order.paidAt!) }), `${order.customer.name}${order.address ? ` - ${order.address}` : ""}`],
      head: [t("col.dish"), t("col.qty"), t("col.price"), t("col.amount")],
      widths: [255, 50, 100, 110],
      rows: order.items.map((i) => [i.name, String(i.quantity), rwf(i.price), rwf(i.price * i.quantity)]),
      totals: [
        [t("guestPaid"), rwf(order.total)],
        [t("totalCommission"), `- ${rwf(commission)}`],
        [t("totalShare"), rwf(share)],
      ],
      footer: t("footer"),
    },
    1,
  );
  return new Response(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="receipt-${reference}.pdf"`, "Cache-Control": "private, no-store" } });
}
