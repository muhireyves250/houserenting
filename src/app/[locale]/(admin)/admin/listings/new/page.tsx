import { getTranslations } from "next-intl/server";
import { PageIntro } from "@/features/admin/components/ui";
import { AdminNewListing } from "@/features/places/components/AdminNewListing";
import { requireAdmin } from "@/lib/permissions";

export default async function AdminNewListingPage() {
  await requireAdmin("/admin/listings/new");
  const [t, tPlaces] = await Promise.all([getTranslations("Admin"), getTranslations("Places")]);
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageIntro back={{ href: "/admin/listings", label: t("nav.listings") }} />
      <div>
        <h2 className="text-[22px] leading-7 font-bold text-ink">{tPlaces("addPlace")}</h2>
        <p className="mt-1 text-[14px] text-muted">{tPlaces("addPlaceIntro")}</p>
      </div>
      <AdminNewListing />
    </div>
  );
}
