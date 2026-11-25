"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { undoEarlyCheckoutAction } from "../actions";

/** Undo an early check-out: the guest is checked in again for the rest of their stay (asks first). */
export function UndoEarlyButton({ reference }: { reference: string }) {
  const t = useTranslations("Host.bookings");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        confirm(t("undoQuestion")) &&
        start(async () => {
          await undoEarlyCheckoutAction(reference);
          router.refresh();
        })
      }
      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[13px] font-semibold text-ink hover:border-primary disabled:opacity-50"
    >
      <RotateCcw className="size-4" aria-hidden="true" />
      {t("undo")}
    </button>
  );
}
