import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { PHOTO_MAX_BYTES, removeProfilePhoto, saveProfilePhoto } from "@/features/users/photo-service";
import { auth } from "@/lib/auth";

/** Upload (POST, field "file") or remove (DELETE) the signed-in person's profile photo. */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > PHOTO_MAX_BYTES + 64 * 1024) return NextResponse.json({ error: "tooLarge" }, { status: 413 });
  const file = (await request.formData().catch(() => null))?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const result = await saveProfilePhoto(session.user.id, new Uint8Array(await file.arrayBuffer()));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  revalidatePath("/[locale]", "layout");
  return NextResponse.json({ image: result.image });
}

export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "auth" }, { status: 401 });
  await removeProfilePhoto(session.user.id);
  revalidatePath("/[locale]", "layout");
  return NextResponse.json({ ok: true });
}
