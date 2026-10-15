import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { BOOKING_STATUSES, bookingsCsv, ledgerCsv, paymentsCsv, type BookingStatusFilter } from "@/features/admin/queries";
import { audit } from "@/features/audit/service";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

/** Staff-only CSV downloads: bookings (with the table's filters), payments, ledger. Each export is logged. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdmin(session.user)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { kind } = await params;
  const search = request.nextUrl.searchParams;
  const status = BOOKING_STATUSES.includes(search.get("status") as BookingStatusFilter) ? (search.get("status") as BookingStatusFilter) : undefined;
  const csv =
    kind === "bookings" ? await bookingsCsv(status, search.get("q")?.slice(0, 100) ?? undefined) : kind === "payments" ? await paymentsCsv() : kind === "ledger" ? await ledgerCsv() : null;
  if (csv === null) return NextResponse.json({ error: "unknown export" }, { status: 404 });
  await audit(db, { actorId: session.user.id, action: "export.download", entityType: "export", entityId: kind });
  const day = new Date().toISOString().slice(0, 10);
  // BOM so spreadsheet apps read the accents (French, Kinyarwanda names) correctly.
  return new NextResponse(`﻿${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="space-rental-${kind}-${day}.csv"`,
      "cache-control": "no-store",
    },
  });
}
