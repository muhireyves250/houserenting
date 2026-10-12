import { getLocale, getTranslations } from "next-intl/server";
import { AuthHeading } from "@/features/auth/components/AuthHeading";
import { SignupForm } from "@/features/auth/components/SignupForm";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect({ href: "/", locale: await getLocale() });
  const t = await getTranslations("Auth");
  return (
    <>
      <AuthHeading title={t("signupTitle")} />
      <SignupForm />
      <p className="mt-6 text-center text-sm">
        {t("haveAccount")}{" "}
        <Link href="/login" className="text-primary underline">
          {t("logIn")}
        </Link>
      </p>
    </>
  );
}
