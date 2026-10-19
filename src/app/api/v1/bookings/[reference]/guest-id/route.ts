import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { DOCUMENT_MAX_BYTES } from "@/features/places/documents-service";
import { readGuestId, uploadGuestId } from "@/features/stay/id-document";
import { auth } from "@/lib/auth";

type Params = { params: Promise<{ reference: string }> };

/** The guest uploads their ID for this booking (only when the place asks for it online). */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > DOCUMENT_MAX_BYTES + 64 * 1024) return NextResponse.json({ error: "tooLarge" }, { status: 413 });
  const file = (await request.formData().catch(() => null))?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const result = await uploadGuestId(session.user.id, (await params).reference, file.name, new Uint8Array(await file.arrayBuffer()));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "notFound" ? 404 : 400 });
  return NextResponse.json({ ok: true });
}

/** The guest, the place's owner, or staff open it. Never cached. */
export async function GET(_request: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "auth" }, { status: 401 });
  const doc = await readGuestId(session.user, (await params).reference);
  if (!doc) return NextResponse.json({ error: "notFound" }, { status: 404 });
  return new NextResponse(new Uint8Array(doc.data), {
    headers: {
      "content-type": doc.mimeType,
      "content-disposition": `inline; filename="${doc.filename.replace(/"/g, "")}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
