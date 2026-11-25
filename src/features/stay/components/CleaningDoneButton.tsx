"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { markCleaningDoneAction } from "../actions";

/** The desk marks a guest's cleaning done (the guest is told). */
export function CleaningDoneButton({ id }: { id: string }) {
  const t = useTranslations("Host.desk.cleaning");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await markCleaningDoneAction(id);
          router.refresh();
        })
      }
      className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-emerald-600 px-4 text-[13px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
    >
      <Check className="size-4" aria-hidden="true" />
      {t("done")}
    </button>
  );
}
