import { BadgeCheck, CircleAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonClasses } from "@/components/ui/Button";
import { AuthHeading } from "@/features/auth/components/AuthHeading";
import { Link } from "@/i18n/navigation";

export default async function VerifiedPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const t = await getTranslations("Auth");
  const failed = Boolean((await searchParams).error);
  return (
    <>
      {failed ? (
        <CircleAlert className="mx-auto mb-6 size-12 text-danger md:mx-0" aria-hidden="true" />
      ) : (
        <BadgeCheck className="mx-auto mb-6 size-12 text-success md:mx-0" aria-hidden="true" />
      )}
      <AuthHeading title={failed ? t("errors.invalidToken") : t("verifiedTitle")} body={failed ? undefined : t("verifiedBody")} />
      <Link href={failed ? "/login" : "/"} className={buttonClasses({ size: "lg", fullWidth: true })}>
        {failed ? t("backToLogin") : t("continue")}
      </Link>
    </>
  );
}
