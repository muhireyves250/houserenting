import { Heart } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { listFavorites } from "@/features/favorites/service";
import { CompactListingCard } from "@/features/home/components/CompactListingCard";
import { requireUser } from "@/lib/session";

export default async function FavoritesPage() {
  const user = await requireUser("/favorites");
  const [t, tNav, favorites] = await Promise.all([getTranslations("Empty"), getTranslations("Nav"), listFavorites(user.id)]);
  return (
    <PageContainer className="flex flex-col gap-6 py-6 md:py-10">
      <h1 className="text-2xl font-bold tracking-[-0.02em] md:text-3xl">{tNav("favorites")}</h1>
      {favorites.length === 0 ? (
        <EmptyState icon={<Heart />} title={t("favoritesTitle")} body={t("favoritesBody")} />
      ) : (
        <ul className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {favorites.map((listing) => (
            <li key={listing.id}>
              <CompactListingCard listing={listing} mode="short" signedIn saved />
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
