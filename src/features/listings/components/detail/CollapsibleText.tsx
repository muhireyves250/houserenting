"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";

// Roughly six lines on a phone; shorter text is shown in full.
const CLAMP_CHARS = 320;

/** Long descriptions start clamped to six lines with Show more / Show less. */
export function CollapsibleText({ text }: { text: string }) {
  const t = useTranslations("Listings");
  const id = useId();
  const [open, setOpen] = useState(false);
  const long = text.length > CLAMP_CHARS;

  return (
    <div>
      <p id={id} className={cn("text-[15px] leading-7 whitespace-pre-line text-ink", long && !open && "line-clamp-6")}>
        {text}
      </p>
      {long && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className="mt-5 w-full rounded-xl bg-canvas py-3 text-[15px] font-semibold text-ink ring-1 ring-line transition-colors hover:bg-line/50 md:w-auto md:px-6"
        >
          {open ? t("showLess") : t("showMore")}
        </button>
      )}
    </div>
  );
}
