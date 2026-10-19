"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { LISTING_MOVES, type ListingMove } from "@/features/listings/lifecycle";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { moveListingAction } from "../actions";

const DANGER: ListingMove[] = ["reject", "hide", "suspend", "archive", "requestChanges"];

/** The status buttons a person may use on a listing; moves the owner must be told about ask for a reason first. */
export function StatusActions({ listingId, moves }: { listingId: string; moves: ListingMove[] }) {
  const t = useTranslations("Places");
  const router = useRouter();
  const [chosen, setChosen] = useState<ListingMove | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (moves.length === 0) return <p className="text-[13px] text-muted">{t("noMoves")}</p>;

  const run = (move: ListingMove) =>
    start(async () => {
      setError(null);
      const result = await moveListingAction(listingId, move, reason);
      if (result.ok) {
        setChosen(null);
        setReason("");
        router.refresh();
      } else setError(t(`moveError.${result.error}`));
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {moves.map((move) => (
          <button
            key={move}
            type="button"
            disabled={pending}
            onClick={() => (LISTING_MOVES[move].reason ? setChosen(chosen === move ? null : move) : run(move))}
            className={cn(
              "rounded-full px-4 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50",
              DANGER.includes(move)
                ? cn("border border-line bg-surface text-danger hover:border-danger", chosen === move && "border-danger")
                : "bg-primary text-white hover:bg-primary-hover",
            )}
          >
            {t(`move.${move}`)}
          </button>
        ))}
      </div>
      {chosen && (
        <div className="flex flex-col gap-2 rounded-xl border border-line p-3 motion-safe:animate-pop-in">
          <label className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-muted">{t("reasonForOwner")}</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} className="w-full resize-y bg-transparent text-[14px] text-ink outline-none" />
          </label>
          <button
            type="button"
            disabled={pending || !reason.trim()}
            onClick={() => run(chosen)}
            className="self-end rounded-full bg-danger px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {t(`move.${chosen}`)}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
