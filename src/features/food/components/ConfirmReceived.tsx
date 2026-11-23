"use client";

import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { confirmDeliveryAction } from "../actions";

/** The guest confirms the food reached them (with the delivery person and receptionist, if any, it is delivered). */
export function ConfirmReceived({ reference }: { reference: string }) {
  const t = useTranslations("Food");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await confirmDeliveryAction(reference);
            router.refresh();
          })
        }
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-[#0a6fe0] px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,87,184,0.8)] transition-[filter,transform] duration-300 hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
      >
        <CheckCircle2 className="size-5" aria-hidden="true" />
        {t("gotIt")}
      </button>
      <p className="text-[12px] text-muted">{t("gotItHint")}</p>
    </div>
  );
}
