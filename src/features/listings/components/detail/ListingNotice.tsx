import { House, Info } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/ui/PageContainer";
import { Link } from "@/i18n/navigation";

/** What a guest sees on the link of a place that isn't bookable right now: the place, and the honest reason. */
export async function ListingNotice({ listing }: { listing: { title: string; status: string; city: string; photos: { url: string }[] } }) {
  const t = await getTranslations("Listings.notice");
  const key = (["HIDDEN", "PAUSED", "SUSPENDED", "ARCHIVED", "CHANGES_REQUESTED"].includes(listing.status) ? listing.status : "HIDDEN") as "HIDDEN";
  return (
    <PageContainer className="flex max-w-xl flex-col items-center py-14 text-center">
      <span className="relative mb-6 flex size-40 items-center justify-center overflow-hidden rounded-3xl bg-primary-soft text-primary">
        {listing.photos[0] ? <Image src={listing.photos[0].url} alt="" fill sizes="160px" className="object-cover opacity-60 grayscale" /> : <House className="size-10" aria-hidden="true" />}
      </span>
      <h1 className="text-[24px] leading-8 font-bold tracking-[-0.02em] text-ink">{listing.title}</h1>
      <p className="mt-1 text-[14px] text-muted">{listing.city}</p>
      <p className="mt-6 flex items-start gap-2 rounded-2xl bg-amber-50 px-5 py-4 text-left text-[15px] text-amber-900 ring-1 ring-amber-200/70">
        <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        {t(key)}
      </p>
      <Link
        href="/search"
        className="mt-8 inline-flex items-center rounded-full bg-primary px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,87,184,0.8)] transition-transform active:scale-[0.97]"
      >
        {t("findAnother")}
      </Link>
    </PageContainer>
  );
}
