"use client";

import { CheckCircle2 } from "lucide-react";
import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { confirmDeliveryAction } from "../actions";

/** Confirms the food reached the guest (the delivery person, or the receptionist at the desk). */
export function ConfirmDeliveryButton({ reference, label }: { reference: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await confirmDeliveryAction(reference);
          router.refresh();
        })
      }
      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
    >
      <CheckCircle2 className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}
