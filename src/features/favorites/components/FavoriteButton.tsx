"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toggleFavoriteAction } from "@/features/favorites/actions";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

const SHELL =
  "flex size-9 items-center justify-center rounded-full transition-transform duration-200 hover:scale-110 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
function HeartIcon({ saved }: { saved: boolean }) {
  return (
    <Heart
      className={cn(
        "size-6 stroke-white stroke-[2.2] drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] transition-[fill,transform] duration-300",
        saved ? "scale-110 fill-[#e11d48]" : "fill-black/35",
      )}
      aria-hidden="true"
    />
  );
}

/**
 * Save-to-favorites heart over a listing photo. Signed-out visitors get the login modal
 * (and come back to the same page); signed-in users toggle instantly, with rollback on failure.
 */
export function FavoriteButton({
  listingId,
  title,
  initialSaved,
  signedIn,
  className,
}: {
  listingId: string;
  title: string;
  initialSaved: boolean;
  signedIn: boolean;
  className?: string;
}) {
  const t = useTranslations("Listings");
  const pathname = usePathname();
  const [saved, setSaved] = useState(initialSaved);
  const [, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <Link
        href={{ pathname: "/login", query: { next: pathname } }}
        aria-label={t("save", { title })}
        className={cn(SHELL, className)}
      >
        <HeartIcon saved={false} />
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? t("unsave", { title }) : t("save", { title })}
      className={cn(SHELL, className)}
      onClick={() => {
        const next = !saved;
        setSaved(next);
        startTransition(async () => {
          const result = await toggleFavoriteAction(listingId);
          if ("error" in result) setSaved(!next);
        });
      }}
    >
      <HeartIcon saved={saved} />
    </button>
  );
}
