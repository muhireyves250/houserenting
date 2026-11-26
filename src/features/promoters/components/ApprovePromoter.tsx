"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { approvePromoterAction } from "../actions";
import { EMPTY_CODE, FirstCodeFields, toFirstCode, type FirstCode } from "./FirstCodeFields";

/** Approve an application: the promoter becomes active with their promo code and share. */
export function ApprovePromoter({ promoterId }: { promoterId: string }) {
  const t = useTranslations("Promoters");
  const router = useRouter();
  const [code, setCode] = useState<FirstCode>(EMPTY_CODE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <FirstCodeFields value={code} onChange={setCode} errors={errors} periodHint={t("periodFromCode")} />
      {failed && <p role="alert" className="text-[13px] font-medium text-danger">{failed}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErrors({});
            setFailed(null);
            const r = await approvePromoterAction(promoterId, toFirstCode(code));
            if (r.ok) router.refresh();
            else if ("errors" in r) setErrors(r.errors);
            else setFailed(t(`staffError.${r.error}`));
          })
        }
        className="self-end rounded-full bg-primary px-5 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
      >
        {t("firstCode.approve")}
      </button>
    </div>
  );
}
