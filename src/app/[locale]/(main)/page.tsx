import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LocaleSwitcher } from "@/components/shell/LocaleSwitcher";
import { PageContainer } from "@/components/ui/PageContainer";
import { OnboardingGate } from "@/features/onboarding/components/OnboardingGate";
import { HomeSearch } from "@/features/search/components/HomeSearch";

export default async function HomePage() {
  const t = await getTranslations("Home");
  return (
    <>
      <OnboardingGate />
      <section className="md:bg-primary md:bg-[radial-gradient(circle_at_20%_20%,#1f6fd1_0,transparent_50%),radial-gradient(circle_at_80%_80%,#003f86_0,transparent_45%)]">
        <PageContainer className="flex flex-col gap-8 pt-6 pb-10 md:items-center md:py-28">
          <div className="flex justify-end md:hidden">
            <Suspense>
              <LocaleSwitcher />
            </Suspense>
          </div>
          <h1 className="mt-16 text-3xl leading-tight md:mt-0 md:text-center md:text-5xl md:text-white">
            <span className="block font-bold">{t("titleTop")}</span>
            <span className="block">{t("titleBottom")}</span>
          </h1>
          <HomeSearch />
        </PageContainer>
      </section>
    </>
  );
}
