import { MailCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/features/auth/components/AuthHeading";
import { ResendVerificationButton } from "@/features/auth/components/ResendVerificationButton";
import { emailSchema } from "@/features/auth/schemas";

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ email?: string | string[] }> }) {
  const t = await getTranslations("Auth");
  const parsed = emailSchema.safeParse((await searchParams).email);
  const email = parsed.success ? parsed.data : null;
  return (
    <>
      <MailCheck className="mx-auto mb-6 size-12 text-primary md:mx-0" aria-hidden="true" />
      <AuthHeading title={t("checkEmailTitle")} body={email ? t("checkEmailBody", { email }) : t("checkEmailNoAddress")} />
      {email && <ResendVerificationButton email={email} />}
    </>
  );
}
