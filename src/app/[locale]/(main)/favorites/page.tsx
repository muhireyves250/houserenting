import { Heart } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { listFavorites } from "@/features/favorites/service";
import { RecentlyViewedRow } from "@/features/listings/components/RecentlyViewed";
import { CompactListingCard } from "@/features/home/components/CompactListingCard";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/session";

export default async function FavoritesPage() {
  const user = await requireUser("/favorites");
  const [t, tNav, favorites] = await Promise.all([getTranslations("Empty"), getTranslations("Nav"), listFavorites(user.id)]);
  const tFooter = await getTranslations("Footer");
  return (
    <PageContainer className="flex flex-col gap-6 py-6 md:py-10">
      <h1 className="text-[32px] leading-10 font-bold tracking-[-0.03em]">{tNav("favorites")}</h1>
      {favorites.length === 0 ? (
        <EmptyState icon={<Heart />} title={t("favoritesTitle")} body={t("favoritesBody")}
          action={<Link
            href="/"
            className="inline-flex items-center rounded-xl bg-primary px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,87,184,0.8)] transition-transform active:scale-[0.97]"
          >
            {tFooter("startSearching")}
          </Link>}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {favorites.map((listing) => (
            <li key={listing.id}>
              <CompactListingCard listing={listing} mode="short" signedIn saved />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6">
        <RecentlyViewedRow />
      </div>
    </PageContainer>
  );
}
