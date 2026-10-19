"use client";

import { Camera } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { useRouter } from "@/i18n/navigation";
import { uploadImage } from "@/lib/cloudinary-upload";
import { profilePhotoTicketAction, saveProfilePhotoUrlAction } from "../photo-actions";

/** The profile picture with a camera button to add or change it, and a way to remove it. */
export function ProfilePhoto({ name, image }: { name: string; image: string | null }) {
  const t = useTranslations("Profile");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(init: RequestInit) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/v1/me/photo", init).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const code = ((await res?.json().catch(() => null)) as { error?: string } | null)?.error;
      setError(code === "tooLarge" ? t("photoTooLarge") : code === "badType" ? t("photoBadType") : t("photoFailed"));
      return;
    }
    router.refresh();
  }

  /** Cloudinary when it's set up (only the link is saved); otherwise the photo is kept in our database. */
  async function upload(file: File) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setError(t("photoBadType"));
    if (file.size > 8 * 1024 * 1024) return setError(t("photoTooLarge"));
    const ticket = await profilePhotoTicketAction().catch(() => null);
    if (!ticket) {
      const body = new FormData();
      body.append("file", file);
      return send({ method: "POST", body });
    }
    setBusy(true);
    setError(null);
    const uploaded = await uploadImage(ticket, file);
    const saved = uploaded ? await saveProfilePhotoUrlAction(uploaded.url) : { ok: false };
    setBusy(false);
    if (!saved.ok) return setError(t("photoFailed"));
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <Avatar name={name} image={image} className="size-24 bg-orange-100 text-4xl text-orange-800" />
        <label
          className="absolute -right-1 -bottom-1 flex size-9 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-md ring-2 ring-surface hover:bg-primary-hover"
          aria-label={image ? t("changePhoto") : t("addPhoto")}
          title={image ? t("changePhoto") : t("addPhoto")}
        >
          <Camera className="size-4.5" aria-hidden="true" />
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
          />
        </label>
      </div>
      {busy && <span className="text-xs text-muted">{t("photoUploading")}</span>}
      {image && !busy && (
        <button type="button" onClick={() => void send({ method: "DELETE" })} className="text-xs font-semibold text-muted hover:text-danger">
          {t("removePhoto")}
        </button>
      )}
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
