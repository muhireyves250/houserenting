"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { hideMyOrderAction } from "../actions";

/** Removes a cancelled order from the customer's list (after a confirm). */
export function RemoveOrder({ reference, compact = false, backToList = false }: { reference: string; compact?: boolean; backToList?: boolean }) {
  const t = useTranslations("Food");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={compact ? t("removeOrder") : undefined}
      title={compact ? t("removeOrder") : undefined}
      onClick={() => {
        if (!window.confirm(t("removeConfirm"))) return;
        start(async () => {
          const { ok } = await hideMyOrderAction(reference);
          if (!ok) return;
          if (backToList) router.push("/orders");
          else router.refresh();
        });
      }}
      className={cn(
        "inline-flex items-center gap-1.5 text-red-700 transition-colors hover:text-red-800 disabled:opacity-50",
        compact ? "rounded-full p-1.5 hover:bg-red-50" : "rounded-full px-4 py-2.5 text-[14px] font-semibold ring-1 ring-red-200 hover:bg-red-50",
      )}
    >
      <Trash2 className="size-4" aria-hidden="true" />
      {!compact && t("removeOrder")}
    </button>
  );
}
