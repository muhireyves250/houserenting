"use client";

import { Mail, User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { authErrorKey, fieldForAuthError, type AuthErrorKey } from "@/features/auth/errors";
import { signupSchema } from "@/features/auth/schemas";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { firstErrors } from "@/lib/zod-errors";
import { PasswordField } from "./PasswordField";

type Errors = Partial<Record<"name" | "email" | "password" | "form", AuthErrorKey>>;

export function SignupForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const message = (key?: AuthErrorKey) => (key ? t(`errors.${key}`) : undefined);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = signupSchema.safeParse({ name: form.get("name"), email: form.get("email"), password: form.get("password") });
    if (!parsed.success) {
      setErrors(firstErrors(parsed.error) as Errors);
      return;
    }
    setErrors({});
    setPending(true);
    const { data, error } = await authClient.signUp.email({ ...parsed.data, locale, callbackURL: `/${locale}/verified` });
    setPending(false);
    if (error) {
      const key = authErrorKey(error);
      setErrors({ [fieldForAuthError(key)]: key });
      return;
    }
    // Email verification off: the new account is already signed in (a session token comes back). Full load so
    // the header and layout show it.
    if (data && "token" in data && data.token) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/${locale}`);
      return;
    }
    router.push({ pathname: "/check-email", query: { email: parsed.data.email } });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <TextField name="name" label={t("name")} icon={<User />} autoComplete="name" error={message(errors.name)} />
      <TextField name="email" type="email" label={t("email")} icon={<Mail />} autoComplete="email" error={message(errors.email)} />
      <PasswordField name="password" label={t("password")} autoComplete="new-password" hint={t("passwordHint")} error={message(errors.password)} />
      {errors.form && (
        <p role="alert" className="text-sm text-danger">
          {message(errors.form)}
        </p>
      )}
      <Button type="submit" size="lg" fullWidth loading={pending}>
        {t("createAccount")}
      </Button>
      <p className="text-center text-xs text-muted">{t("terms")}</p>
    </form>
  );
}
