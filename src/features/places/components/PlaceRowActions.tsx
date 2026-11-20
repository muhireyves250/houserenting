"use client";

import { ChevronDown, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ListingMove } from "@/features/listings/lifecycle";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { ConfirmAction } from "@/features/admin/components/ConfirmAction";
import { deletePlaceAction } from "../actions";
import { StatusActions } from "./StatusActions";

/** A place's row in the staff list: Edit, and its status buttons one tap away (opened under the row). */
export function PlaceRowActions({ listingId, moves, editable, deletable = false }: { listingId: string; moves: ListingMove[]; editable: boolean; /** Never booked: can be deleted. */ deletable?: boolean }) {
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
        {/* Never booked: delete it for good, right here (booked places are archived instead). */}
        {deletable && (
          <ConfirmAction
            label={t("deleteShort")}
            question={t("deletePlaceQuestion")}
            action={deletePlaceAction.bind(null, listingId)}
            errors={{ hasBookings: t("deleteHasBookings"), notAllowed: t("deleteNotAllowed") }}
          />
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
        <div className="flex w-full max-w-md flex-col gap-3 rounded-xl bg-canvas p-3">
          <StatusActions listingId={listingId} moves={moves} />
        </div>
      )}
    </div>
  );
}
