"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { authErrorKey, type AuthErrorKey } from "@/features/auth/errors";
import { resetPasswordSchema } from "@/features/auth/schemas";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { firstErrors } from "@/lib/zod-errors";
import { PasswordField } from "./PasswordField";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const t = useTranslations("Auth");
  const [error, setError] = useState<AuthErrorKey | null>(token ? null : "invalidToken");
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  if (done) {
    return (
      <div className="flex flex-col gap-5">
        <p role="status" className="text-sm text-success">
          {t("resetDone")}
        </p>
        <Link href="/login" className={buttonClasses({ size: "lg", fullWidth: true })}>
          {t("logIn")}
        </Link>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const parsed = resetPasswordSchema.safeParse({ password: new FormData(event.currentTarget).get("password") });
    if (!parsed.success) {
      setError(firstErrors(parsed.error).password as AuthErrorKey);
      return;
    }
    setPending(true);
    const result = await authClient.resetPassword({ newPassword: parsed.data.password, token });
    setPending(false);
    if (result.error) {
      setError(authErrorKey(result.error));
      return;
    }
    setDone(true);
  }

  const passwordError = error && error.startsWith("password") ? t(`errors.${error}`) : undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <PasswordField
        name="password"
        label={t("newPassword")}
        autoComplete="new-password"
        hint={t("passwordHint")}
        error={passwordError}
        disabled={!token}
      />
      {error && !passwordError && (
        <p role="alert" className="text-sm text-danger">
          {t(`errors.${error}`)}{" "}
          {error === "invalidToken" && (
            <Link href="/forgot-password" className="underline">
              {t("forgotTitle")}
            </Link>
          )}
        </p>
      )}
      <Button type="submit" size="lg" fullWidth loading={pending} disabled={!token}>
        {t("resetSubmit")}
      </Button>
    </form>
  );
}
