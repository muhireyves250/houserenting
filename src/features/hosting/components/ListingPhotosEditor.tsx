"use client";

import { ImagePlus, LoaderCircle, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { addPhotoAction, photoUploadAction, removePhotoAction } from "../actions";
import { Card } from "./fields";

type Photo = { id: string; url: string };

/** Photos go straight from the browser to our Cloudinary folder (signed by the server), then get attached to the place. */
export function ListingPhotosEditor({ listingId, photos, enabled }: { listingId: string; photos: Photo[]; enabled: boolean }) {
  const t = useTranslations("Host");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [failed, setFailed] = useState(false);
  const [removing, startRemoving] = useTransition();

  async function upload(file: File): Promise<boolean> {
    const ticket = await photoUploadAction(listingId);
    if (!ticket) return false;
    const body = new FormData();
    body.append("file", file);
    body.append("api_key", ticket.apiKey);
    body.append("timestamp", String(ticket.timestamp));
    body.append("folder", ticket.folder);
    body.append("signature", ticket.signature);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${ticket.cloudName}/image/upload`, { method: "POST", body });
    if (!response.ok) return false;
    const uploaded = (await response.json()) as { secure_url: string; public_id: string; width: number; height: number };
    const { ok } = await addPhotoAction(listingId, {
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      width: uploaded.width,
      height: uploaded.height,
    });
    return ok;
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setFailed(false);
    const images = [...files].filter((f) => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024);
    if (images.length < files.length) setFailed(true);
    setUploading(images.length);
    for (const file of images) {
      const ok = await upload(file).catch(() => false);
      if (!ok) setFailed(true);
      setUploading((n) => n - 1);
    }
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <Card title={t("sections.photos")} id="photos">
      {!enabled && <p className="mb-4 text-[13px] text-muted">{t("photosOff")}</p>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((photo, index) => (
          <li key={photo.id} className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-canvas">
            <Image src={photo.url} alt={t("photoAlt", { n: index + 1 })} fill sizes="(min-width: 640px) 33vw, 50vw" className="object-cover" />
            <button
              type="button"
              disabled={removing}
              onClick={() =>
                startRemoving(async () => {
                  await removePhotoAction(listingId, photo.id);
                  router.refresh();
                })
              }
              aria-label={t("removePhoto")}
              className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-white/95 text-ink shadow transition-transform active:scale-90"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
        {enabled && (
          <li>
            <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong text-sm font-semibold text-primary transition-colors hover:border-primary hover:bg-primary/[0.04]">
              {uploading > 0 ? <LoaderCircle className="size-6 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-6" aria-hidden="true" />}
              {uploading > 0 ? t("uploading", { count: uploading }) : t("addPhotos")}
              <input ref={input} type="file" accept="image/*" multiple className="sr-only" disabled={uploading > 0} onChange={(e) => void onFiles(e.target.files)} />
            </label>
          </li>
        )}
      </ul>
      {failed && (
        <p role="alert" className="mt-3 text-[13px] font-medium text-danger">
          {t("photoFailed")}
        </p>
      )}
    </Card>
  );
}
