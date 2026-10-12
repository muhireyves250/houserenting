import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/features/auth/components/AuthHeading";
import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";
import { Link } from "@/i18n/navigation";

export default async function ForgotPasswordPage() {
  const t = await getTranslations("Auth");
  return (
    <>
      <AuthHeading title={t("forgotTitle")} body={t("forgotBody")} />
      <ForgotPasswordForm />
      <Link href="/login" className="mt-6 text-center text-sm text-primary underline">
        {t("backToLogin")}
      </Link>
    </>
  );
}
