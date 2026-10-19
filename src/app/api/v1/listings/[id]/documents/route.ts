import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { DOCUMENT_MAX_BYTES, uploadDocument } from "@/features/places/documents-service";
import { auth } from "@/lib/auth";

/** Upload a private property document (owner ID, proof of ownership, management authorisation). Owner or staff only. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "auth" }, { status: 401 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > DOCUMENT_MAX_BYTES + 64 * 1024) return NextResponse.json({ error: "tooLarge" }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind");
  if (!(file instanceof File) || typeof kind !== "string") return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { id } = await params;
  const result = await uploadDocument(session.user, id, kind, file.name, new Uint8Array(await file.arrayBuffer()));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "notAllowed" ? 403 : 400 });
  return NextResponse.json({ id: result.id });
}
