import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonClasses } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("Errors");
  const tCommon = await getTranslations("Common");
  return (
    <PageContainer className="py-16">
      <EmptyState
        icon={<SearchX />}
        title={t("notFoundTitle")}
        body={t("notFoundBody")}
        action={
          <Link href="/" className={buttonClasses()}>
            {tCommon("goHome")}
          </Link>
        }
      />
    </PageContainer>
  );
}
