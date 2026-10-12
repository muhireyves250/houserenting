"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { authErrorKey } from "@/features/auth/errors";
import { authClient } from "@/lib/auth-client";

export function ResendVerificationButton({ email }: { email: string }) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [status, setStatus] = useState<"idle" | "sent" | "tooMany" | "error">("idle");
  const [pending, setPending] = useState(false);

  async function resend() {
    setPending(true);
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: `/${locale}/verified` });
    setPending(false);
    setStatus(!error ? "sent" : authErrorKey(error) === "tooMany" ? "tooMany" : "error");
  }

  return (
    <div className="flex flex-col gap-3">
      <Button variant="outline" size="lg" fullWidth loading={pending} onClick={resend}>
        {t("resend")}
      </Button>
      {status === "sent" && (
        <p role="status" className="text-sm text-success">
          {t("resent")}
        </p>
      )}
      {(status === "tooMany" || status === "error") && (
        <p role="alert" className="text-sm text-danger">
          {t(status === "tooMany" ? "errors.tooMany" : "errors.generic")}
        </p>
      )}
    </div>
  );
}
