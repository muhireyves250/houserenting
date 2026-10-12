"use client";

import { Mail } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { authErrorKey, type AuthErrorKey } from "@/features/auth/errors";
import { loginSchema } from "@/features/auth/schemas";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { safeNextPath } from "@/lib/safe-redirect";
import { PasswordField } from "./PasswordField";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
    if (!parsed.success) {
      setError("invalidCredentials");
      return;
    }
    setError(null);
    setPending(true);
    const result = await authClient.signIn.email({ ...parsed.data, callbackURL: `/${locale}/verified` });
    setPending(false);
    if (result.error) {
      setError(authErrorKey(result.error));
      return;
    }
    router.push(safeNextPath(next));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <TextField name="email" type="email" label={t("email")} icon={<Mail />} autoComplete="email" />
      <PasswordField name="password" label={t("password")} autoComplete="current-password" />
      <Link href="/forgot-password" className="self-start text-sm text-primary underline">
        {t("forgotPassword")}
      </Link>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {t(`errors.${error}`)}
        </p>
      )}
      <Button type="submit" size="lg" fullWidth loading={pending}>
        {t("logIn")}
      </Button>
    </form>
  );
}
