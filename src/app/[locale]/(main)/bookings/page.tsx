import { House } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/session";

export default async function BookingsPage() {
  await requireUser("/bookings");
  const t = await getTranslations("Empty");
  const tNav = await getTranslations("Nav");
  const tFooter = await getTranslations("Footer");
  return (
    <PageContainer className="py-6">
      <h1 className="text-[26px] leading-8 font-bold tracking-[-0.03em] md:text-[32px] md:leading-10">{tNav("bookings")}</h1>
      <EmptyState icon={<House />} title={t("bookingsTitle")} body={t("bookingsBody")}
          action={<Link
            href="/"
            className="inline-flex items-center rounded-xl bg-primary px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,87,184,0.8)] transition-transform active:scale-[0.97]"
          >
            {tFooter("startSearching")}
          </Link>}
        />
    </PageContainer>
  );
}
