import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { readDocument } from "@/features/places/documents-service";
import { auth } from "@/lib/auth";

/** Download a private property document: the listing's owner or staff only (staff views are logged). Never cached. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "auth" }, { status: 401 });
  const doc = await readDocument(session.user, (await params).id);
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
