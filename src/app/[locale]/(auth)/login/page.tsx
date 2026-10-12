import { getLocale, getTranslations } from "next-intl/server";
import { AuthHeading } from "@/features/auth/components/AuthHeading";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { Link, redirect } from "@/i18n/navigation";
import { safeNextPath } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/lib/session";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = safeNextPath((await searchParams).next);
  if (await getCurrentUser()) redirect({ href: next, locale: await getLocale() });
  const t = await getTranslations("Auth");
  return (
    <>
      <AuthHeading title={t("loginTitle")} />
      <LoginForm next={next} />
      <p className="mt-6 text-center text-sm">
        {t("noAccount")}{" "}
        <Link href="/signup" className="text-primary underline">
          {t("createAccount")}
        </Link>
      </p>
    </>
  );
}
