import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/features/auth/components/AuthHeading";
import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const t = await getTranslations("Auth");
  const { token, error } = await searchParams;
  return (
    <>
      <AuthHeading title={t("resetTitle")} />
      <ResetPasswordForm token={!error && typeof token === "string" && token ? token : null} />
    </>
  );
}
