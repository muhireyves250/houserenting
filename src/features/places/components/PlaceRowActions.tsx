"use client";

import { ChevronDown, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ListingMove } from "@/features/listings/lifecycle";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { StatusActions } from "./StatusActions";

/** A place's row in the staff list: Edit, and its status buttons one tap away (opened under the row). */
export function PlaceRowActions({ listingId, moves, editable }: { listingId: string; moves: ListingMove[]; editable: boolean }) {
  const t = useTranslations("Places");
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-end gap-2 max-sm:items-stretch">
      <div className="flex items-center gap-2 max-sm:justify-end">
        {editable && (
          <Link href={`/admin/listings/${listingId}/edit`} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[13px] font-semibold text-ink hover:border-primary">
            <Pencil className="size-3.5" aria-hidden="true" />
            {t("editShort")}
          </Link>
        )}
        {moves.length > 0 && (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className={cn("inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[13px] font-semibold", open ? "border-primary text-primary" : "border-line text-ink hover:border-primary")}
          >
            {t("statusTitle")}
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden="true" />
          </button>
        )}
      </div>
      {open && (
        <div className="w-full max-w-md rounded-xl bg-canvas p-3">
          <StatusActions listingId={listingId} moves={moves} />
        </div>
      )}
    </div>
  );
}
