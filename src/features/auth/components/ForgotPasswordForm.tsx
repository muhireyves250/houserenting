"use client";

import { Mail } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { authErrorKey } from "@/features/auth/errors";
import { forgotPasswordSchema } from "@/features/auth/schemas";
import { authClient } from "@/lib/auth-client";

type Status = "idle" | "sent" | "invalid" | "tooMany";

export function ForgotPasswordForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [status, setStatus] = useState<Status>("idle");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = forgotPasswordSchema.safeParse({ email: new FormData(event.currentTarget).get("email") });
    if (!parsed.success) {
      setStatus("invalid");
      return;
    }
    setPending(true);
    const { error } = await authClient.requestPasswordReset({ email: parsed.data.email, redirectTo: `/${locale}/reset-password` });
    setPending(false);
    // Always report "sent" (except rate limiting) so the form never reveals which emails have accounts.
    setStatus(error && authErrorKey(error) === "tooMany" ? "tooMany" : "sent");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <TextField
        name="email"
        type="email"
        label={t("email")}
        icon={<Mail />}
        autoComplete="email"
        error={status === "invalid" ? t("errors.emailInvalid") : undefined}
      />
      {status === "sent" && (
        <p role="status" className="text-sm text-success">
          {t("linkSent")}
        </p>
      )}
      {status === "tooMany" && (
        <p role="alert" className="text-sm text-danger">
          {t("errors.tooMany")}
        </p>
      )}
      <Button type="submit" size="lg" fullWidth loading={pending}>
        {t("sendLink")}
      </Button>
    </form>
  );
}
