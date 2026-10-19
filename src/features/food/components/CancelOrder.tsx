"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { moveOrderAction } from "../actions";

export function CancelOrder({ reference }: { reference: string }) {
  const t = useTranslations("Food");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await moveOrderAction(reference, "CANCELLED", "");
          router.refresh();
        })
      }
      className="text-[13px] font-semibold text-danger hover:underline disabled:opacity-50"
    >
      {t("cancelOrder")}
    </button>
  );
}
