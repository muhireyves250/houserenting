"use client";

import { Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { ACCOUNT_EVENT, forgetAccount, maskEmail, parseRemembered, rememberAccount, rememberedSnapshot } from "@/features/auth/remembered";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { authErrorKey, type AuthErrorKey } from "@/features/auth/errors";
import { loginSchema } from "@/features/auth/schemas";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { safeNextPath } from "@/lib/safe-redirect";
import { PasswordField } from "./PasswordField";

/**
 * `onSuccess` replaces the default "go to next" navigation, and `onForgot` replaces the
 * "Forgot password?" link with an in-place action (both used by the auth modal).
 */
export function LoginForm({ next, onSuccess, onForgot }: { next?: string; onSuccess?: () => void; onForgot?: () => void }) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [pending, setPending] = useState(false);
  // "Welcome back": the last account that logged in on this device (read after hydration).
  const raw = useSyncExternalStore(
    (onChange) => {
      window.addEventListener(ACCOUNT_EVENT, onChange);
      return () => window.removeEventListener(ACCOUNT_EVENT, onChange);
    },
    rememberedSnapshot,
    () => "",
  );
  const remembered = useMemo(() => parseRemembered(raw), [raw]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({ email: remembered?.email ?? form.get("email"), password: form.get("password") });
    if (!parsed.success) {
      setError("invalidCredentials");
      return;
    }
    setError(null);
    setPending(true);
    const result = await authClient.signIn.email(parsed.data);
    setPending(false);
    if (result.error) {
      setError(authErrorKey(result.error));
      return;
    }
    const user = result.data?.user;
    if (user?.name && user.email) rememberAccount({ name: user.name, email: user.email });
    if (onSuccess) return onSuccess();
    router.push(safeNextPath(next));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {remembered ? (
        <div className="flex flex-col items-center gap-2 text-center motion-safe:animate-pop-in">
          <Avatar name={remembered.name} className="size-20 bg-orange-100 text-3xl text-orange-800" />
          <p className="mt-1 text-[22px] leading-7 font-bold tracking-[-0.02em] text-ink">
            {t("welcomeBack", { name: remembered.name.split(" ")[0] ?? remembered.name })}
          </p>
          {/* Lets password managers match the saved login for this account. */}
          <input type="email" name="email" value={remembered.email} readOnly autoComplete="username" tabIndex={-1} aria-hidden="true" className="sr-only" />
          <p className="flex items-center gap-2 text-[15px] text-ink/80">
            <Mail className="size-4" aria-hidden="true" />
            {maskEmail(remembered.email)}
          </p>
        </div>
      ) : (
        <TextField name="email" type="email" label={t("email")} icon={<Mail />} autoComplete="email" />
      )}
      <PasswordField name="password" label={t("password")} autoComplete="current-password" />
      {onForgot ? (
        <button type="button" onClick={onForgot} className="self-start text-sm text-primary underline">
          {t("forgotPassword")}
        </button>
      ) : (
        <Link href="/forgot-password" className="self-start text-sm text-primary underline">
          {t("forgotPassword")}
        </Link>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {t(`errors.${error}`)}
        </p>
      )}
      <Button type="submit" size="lg" fullWidth loading={pending}>
        {t("logIn")}
      </Button>
      {remembered && (
        <button type="button" onClick={forgetAccount} className="self-center text-[15px] font-semibold text-ink underline underline-offset-4 hover:text-primary">
          {t("notYou")}
        </button>
      )}
    </form>
  );
}
