import { createTranslator } from "next-intl";
import { moneyPdf } from "@/features/food/money-pdf";
import { canRestaurant, restaurantMoney, restaurantRole } from "@/features/food/service";
import { catalogs } from "@/i18n/messages";
import { toAppLocale } from "@/i18n/routing";
import { db } from "@/lib/db";
import { formatRWF } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";

/** A restaurant's daily report as a PDF (?day=YYYY-MM-DD): every paid order that day, VIIPA's commission and its share. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const url = new URL(request.url);
  const day = url.searchParams.get("day") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !canRestaurant(await restaurantRole(user, id), "money")) return new Response("Not found", { status: 404 });
  const r = await db.restaurant.findUnique({ where: { id }, select: { name: true } });
  if (!r) return new Response("Not found", { status: 404 });
  const locale = toAppLocale(url.searchParams.get("lang"));
  const t = createTranslator({ locale, messages: catalogs[locale], namespace: "Food.money" });
  const money = await restaurantMoney(id, new Date(`${day}T23:00:00+02:00`), 2);
  const list = money.orders.filter((o) => o.day === day);
  const rwf = (n: number) => formatRWF(n, locale);
  const pdf = await moneyPdf(
    {
      title: t("reportTitle"),
      meta: [r.name, t("reportDay", { day }), t("ordersCount", { count: list.length })],
      head: [t("col.order"), t("col.time"), t("col.guest"), t("col.paid"), t("col.commission"), t("col.share")],
      widths: [80, 50, 120, 90, 85, 90],
      rows: list.map((o) => [o.reference, new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" }).format(o.paidAt), o.customer, rwf(o.total), rwf(o.commission), rwf(o.share)]),
      totals: [
        [t("totalSales"), rwf(list.reduce((n, o) => n + o.total, 0))],
        [t("totalCommission"), rwf(list.reduce((n, o) => n + o.commission, 0))],
        [t("totalShare"), rwf(list.reduce((n, o) => n + o.share, 0))],
      ],
      footer: t("footer"),
    },
    3,
  );
  return new Response(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="report-${day}.pdf"`, "Cache-Control": "private, no-store" } });
}
