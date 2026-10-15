import { NextResponse, type NextRequest } from "next/server";
import { expireAllHolds } from "@/features/bookings/service";
import { getEnv } from "@/lib/env";

/** Scheduled job (Vercel Cron): release lapsed payment holds. Requires `Authorization: Bearer <CRON_SECRET>`. */
export async function GET(request: NextRequest) {
  const secret = getEnv().CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const released = await expireAllHolds();
  return NextResponse.json({ released });
}
