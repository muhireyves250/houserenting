import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { readEbm, uploadEbm } from "@/features/invoices/ebm";
import { DOCUMENT_MAX_BYTES } from "@/features/places/documents-service";
import { auth } from "@/lib/auth";

/** Upload the booking's EBM receipt (PDF or photo): VIIPA, or the place's owner, managers and receptionists. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "auth" }, { status: 401 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > DOCUMENT_MAX_BYTES + 64 * 1024) return NextResponse.json({ error: "tooLarge" }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { reference } = await params;
  const result = await uploadEbm(session.user, reference, file.name, new Uint8Array(await file.arrayBuffer()));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "notAllowed" ? 403 : 400 });
  return NextResponse.json({ ok: true });
}

/** Download it: the booking's guest, or anyone running the place. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { reference } = await params;
  const ebm = await readEbm(session.user, reference);
  if (!ebm) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(ebm.data), {
    headers: { "Content-Type": ebm.mimeType, "Content-Disposition": `attachment; filename="EBM-${reference}${ebm.mimeType === "application/pdf" ? ".pdf" : ""}"`, "Cache-Control": "private, no-store" },
  });
}
