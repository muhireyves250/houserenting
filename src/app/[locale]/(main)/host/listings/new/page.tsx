import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/ui/PageContainer";
import { EMPTY_LISTING, ListingForm } from "@/features/hosting/components/ListingForm";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/session";

export default async function NewListingPage() {
  await requireUser("/host/listings/new");
  const t = await getTranslations("Host");
  return (
    <PageContainer className="max-w-3xl py-6 md:py-10">
      <Link href="/host" className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t("title")}
      </Link>
      <h1 className="mb-2 text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{t("newListing")}</h1>
      <p className="mb-6 text-[15px] text-muted">{t("newIntro")}</p>
      <ListingForm listingId={null} initial={EMPTY_LISTING} live={false} />
    </PageContainer>
  );
}
