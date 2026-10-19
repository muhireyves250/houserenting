import { NextResponse } from "next/server";
import { profilePhoto } from "@/features/users/photo-service";

/** A profile photo. The link changes when the photo does (?v=…), so it can be cached for a long time. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  if (id.length > 64) return NextResponse.json({ error: "notFound" }, { status: 404 });
  const photo = await profilePhoto(id);
  if (!photo) return NextResponse.json({ error: "notFound" }, { status: 404 });
  return new NextResponse(new Uint8Array(photo.data), {
    headers: { "content-type": photo.mimeType, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
  });
}
