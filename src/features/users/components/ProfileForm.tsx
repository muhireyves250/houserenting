"use client";

import { BadgeCheck, Phone, User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { updateProfileAction, type ProfileFormState } from "@/features/users/actions";
import type { ProfileErrorKey } from "@/features/users/schemas";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

type Profile = { name: string; email: string; emailVerified: boolean; phone: string | null; locale: AppLocale };

const INITIAL: ProfileFormState = { status: "idle" };

export function ProfileForm({ profile }: { profile: Profile }) {
  const t = useTranslations("Profile");
  const tLocale = useTranslations("Locale");
  const tCommon = useTranslations("Common");
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [state, formAction, pending] = useActionState(updateProfileAction, INITIAL);

  useEffect(() => {
    if (state.status === "saved" && state.locale && state.locale !== currentLocale) {
      router.replace(pathname, { locale: state.locale });
    }
  }, [state, currentLocale, pathname, router]);

  const error = (key?: ProfileErrorKey) => (key ? t(`errors.${key}`) : undefined);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <TextField name="name" label={t("name")} icon={<User />} defaultValue={profile.name} autoComplete="name" error={error(state.errors?.name)} />

      <div className="flex flex-col gap-1">
        <span className="text-sm text-muted">{t("email")}</span>
        <div className="flex items-center gap-2 border-b border-line py-2">
          <span className="flex-1 text-base">{profile.email}</span>
          {profile.emailVerified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">
              <BadgeCheck className="size-3.5" aria-hidden="true" />
              {t("verified")}
            </span>
          ) : (
            <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-muted">{t("notVerified")}</span>
          )}
        </div>
      </div>

      <TextField
        name="phone"
        type="tel"
        label={t("phone")}
        icon={<Phone />}
        defaultValue={profile.phone ?? ""}
        autoComplete="tel"
        hint={t("phoneHint")}
        error={error(state.errors?.phone)}
      />

      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">{t("language")}</span>
        <select name="locale" defaultValue={profile.locale} className="border-b border-line bg-transparent py-2 text-base outline-none focus:border-primary">
          {routing.locales.map((value) => (
            <option key={value} value={value}>
              {tLocale(value)}
            </option>
          ))}
        </select>
        {state.errors?.locale && (
          <span role="alert" className="text-xs text-danger">
            {error(state.errors.locale)}
          </span>
        )}
      </label>

      {state.errors?.form && (
        <p role="alert" className="text-sm text-danger">
          {error(state.errors.form)}
        </p>
      )}

      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" loading={pending} className="min-w-40">
          {pending ? tCommon("saving") : tCommon("save")}
        </Button>
        {state.status === "saved" && !pending && (
          <p role="status" className="text-sm text-success">
            {tCommon("saved")}
          </p>
        )}
      </div>
    </form>
  );
}
