import { NextResponse, type NextRequest } from "next/server";
import { suggestLocations } from "@/features/listings/service";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const locations = await suggestLocations(q);
  return NextResponse.json({ locations }, { headers: { "Cache-Control": "public, max-age=60" } });
}
