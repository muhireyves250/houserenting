"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { givePromoCodeAction } from "../actions";
import { EMPTY_CODE, FirstCodeFields, toFirstCode, type FirstCode } from "./FirstCodeFields";

/** "+ Give a promo code" on a promoter's card: opens the code, discount and share fields right there. */
export function GivePromoCode({ promoterId }: { promoterId: string }) {
  const t = useTranslations("Promoters");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<FirstCode>(EMPTY_CODE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="ml-auto text-[12px] font-semibold text-primary hover:underline">
        + {t("givePromoCode")}
      </button>
    );
  return (
    <div className="flex w-full flex-col gap-2">
      <FirstCodeFields value={code} onChange={setCode} errors={errors} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-ink hover:bg-surface">
          {t("cancel")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setErrors({});
              const r = await givePromoCodeAction(promoterId, toFirstCode(code));
              if (r.ok) {
                setOpen(false);
                setCode(EMPTY_CODE);
                router.refresh();
              } else if ("errors" in r) setErrors(r.errors);
              else setErrors({ code: "code" });
            })
          }
          className="rounded-full bg-primary px-4 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {t("givePromoCode")}
        </button>
      </div>
    </div>
  );
}
