"use client";

import { CircleCheck, Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { toggleFavoriteAction } from "@/features/favorites/actions";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { PlacePreview, type PlacePreviewData } from "./PlacePreview";

const ICON_TRIGGER =
  "flex size-10 items-center justify-center rounded-full bg-white/95 text-ink shadow-[0_4px_14px_rgba(0,0,0,0.25)] backdrop-blur transition-transform duration-200 active:scale-90";
const TRIGGER =
  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-ink underline underline-offset-4 transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function HeartMark({ saved }: { saved: boolean }) {
  return (
    <Heart
      className={cn("size-4 transition-[fill,stroke,transform] duration-300", saved ? "scale-110 fill-[#e11d48] stroke-[#e11d48]" : "stroke-ink")}
      aria-hidden="true"
    />
  );
}

/** Save opens a window to add the place to (or remove it from) Favorites. Signed-out visitors log in first. */
export function SaveButton({
  listingId,
  initialSaved,
  signedIn,
  variant = "text",
  ...preview
}: PlacePreviewData & { listingId: string; initialSaved: boolean; signedIn: boolean; variant?: "text" | "icon" }) {
  const t = useTranslations("Listings");
  const pathname = usePathname();
  const [saved, setSaved] = useState(initialSaved);
  const [open, setOpen] = useState(false);
  // What just happened in the window: a confirmation, or a failure to retry.
  const [status, setStatus] = useState<"idle" | "saved" | "removed" | "failed">("idle");
  const [pending, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <Link
        href={{ pathname: "/login", query: { next: pathname } }}
        aria-label={variant === "icon" ? t("saveShort") : undefined}
        className={variant === "icon" ? ICON_TRIGGER : TRIGGER}
      >
        <HeartMark saved={false} />
        {variant === "text" && t("saveShort")}
      </Link>
    );
  }

  function toggle() {
    startTransition(async () => {
      const result = await toggleFavoriteAction(listingId);
      if ("error" in result) return setStatus("failed");
      setSaved(result.saved);
      setStatus(result.saved ? "saved" : "removed");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setStatus("idle");
          setOpen(true);
        }}
        aria-label={variant === "icon" ? (saved ? t("savedShort") : t("saveShort")) : undefined}
        className={variant === "icon" ? ICON_TRIGGER : TRIGGER}
      >
        <HeartMark saved={saved} />
        {variant === "text" && (saved ? t("savedShort") : t("saveShort"))}
      </button>
      {open && (
        <Modal title={t("saveTitle")} closeLabel={t("close")} onClose={() => setOpen(false)} className="md:max-w-lg">
          <PlacePreview {...preview} />

          {(status === "saved" || status === "removed") && (
            <p className="mt-5 flex items-center justify-center gap-2 text-[15px] font-semibold text-ink motion-safe:animate-pop-in" role="status">
              <CircleCheck className={cn("size-5", status === "saved" ? "text-success" : "text-muted")} aria-hidden="true" />
              {status === "saved" ? t("savedToFavorites") : t("removedFromFavorites")}
            </p>
          )}
          {status === "failed" && (
            <p className="mt-5 text-center text-sm font-medium text-danger" role="alert">
              {t("saveFailed")}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={toggle}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-full py-3.5 text-[15px] font-semibold transition-[background-color,transform,opacity] duration-300 active:scale-[0.98] disabled:opacity-60",
                saved ? "border border-ink/80 bg-surface text-ink hover:bg-canvas" : "bg-primary text-white shadow-[0_10px_24px_-10px_rgba(0,87,184,0.8)] hover:bg-primary-hover",
              )}
            >
              <Heart className={cn("size-4", saved ? "fill-[#e11d48] stroke-[#e11d48]" : "fill-white/20")} aria-hidden="true" />
              {saved ? t("removeFromFavorites") : t("saveToFavorites")}
            </button>
            <Link href="/favorites" className="text-center text-sm font-semibold text-ink underline underline-offset-4 transition-colors hover:text-primary">
              {t("viewFavorites")}
            </Link>
          </div>
        </Modal>
      )}
    </>
  );
}
