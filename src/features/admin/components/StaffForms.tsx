"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useRouter } from "@/i18n/navigation";
import { setUserStatusAction, staffCancelBookingAction } from "../moderation-actions";

function ReasonBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="flex flex-col gap-0.5 rounded-xl border border-line-strong bg-surface px-3 py-2 focus-within:border-primary">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} maxLength={300} className="w-full resize-y bg-transparent text-[14px] text-ink outline-none" />
    </label>
  );
}

/** Release an unpaid hold (the guest is told). */
export function StaffCancel({ reference }: { reference: string }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted">{t("releaseHoldHint")}</p>
      <ReasonBox value={reason} onChange={setReason} label={t("reasonInternal")} />
      {failed && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {t("actionFailed")}
        </p>
      )}
      <Button
        variant="outline"
        className="text-danger"
        loading={pending}
        disabled={!reason.trim()}
        onClick={() =>
          start(async () => {
            const { ok } = await staffCancelBookingAction(reference, reason);
            setFailed(!ok);
            if (ok) router.refresh();
          })
        }
      >
        {t("releaseHold")}
      </Button>
    </div>
  );
}

/** Suspend (signs the person out everywhere, blocks sign-in) or reactivate an account. */
export function UserStatusForm({ userId, status }: { userId: string; status: "ACTIVE" | "SUSPENDED" }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const suspending = status === "ACTIVE";
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted">{suspending ? t("suspendHint") : t("reactivateHint")}</p>
      <ReasonBox value={reason} onChange={setReason} label={t("reasonInternal")} />
      {failed && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {t("actionFailed")}
        </p>
      )}
      <Button
        variant={suspending ? "outline" : "primary"}
        className={suspending ? "text-danger" : undefined}
        loading={pending}
        disabled={suspending && !reason.trim()}
        onClick={() =>
          start(async () => {
            const { ok } = await setUserStatusAction(userId, suspending ? "SUSPENDED" : "ACTIVE", reason);
            setFailed(!ok);
            if (ok) {
              setReason("");
              router.refresh();
            }
          })
        }
      >
        {suspending ? t("suspend") : t("reactivate")}
      </Button>
    </div>
  );
}
