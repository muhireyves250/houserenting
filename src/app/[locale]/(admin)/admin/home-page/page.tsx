import { getTranslations } from "next-intl/server";
import { PageIntro, Panel } from "@/features/admin/components/ui";
import { HomeSectionsEditor } from "@/features/home/components/HomeSectionsEditor";
import { sectionsForStaff } from "@/features/home/sections-service";
import { requireStaff } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("Admin.homePage");
  return { title: t("pageTitle") };
}

/** Staff run the guest home page: its rows (Hot deals and the sections), their order and the houses shown first. */
export default async function HomePageAdmin() {
  await requireStaff("listings", "/admin/home-page");
  const [t, sections] = await Promise.all([getTranslations("Admin.homePage"), sectionsForStaff()]);
  return (
    <div className="flex flex-col gap-4">
      <PageIntro />
      <Panel title={t("pageTitle")}>
        <HomeSectionsEditor sections={sections.map((s) => ({ id: s.id, kind: s.kind, title: s.title, subtitle: s.subtitle, places: s.places, types: s.types, mode: s.mode, houseIds: s.houseIds, active: s.active, houses: s.houses }))} />
      </Panel>
    </div>
  );
}
