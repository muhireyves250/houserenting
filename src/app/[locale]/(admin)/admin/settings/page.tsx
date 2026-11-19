import { ScrollText, Settings, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageTabs, StickyTabs } from "@/features/admin/components/kit";
import { ActivityLogView } from "@/features/admin/views/ActivityLogView";
import { SettingsView } from "@/features/admin/views/SettingsView";
import { UsersView } from "@/features/admin/views/UsersView";
import { requireStaff } from "@/lib/permissions";

type Props = { searchParams: Promise<{ tab?: string; type?: string; page?: string; filter?: string; q?: string }> };

/** Settings, users and the activity log (who changed what), as three tabs. */
export default async function SettingsPage({ searchParams }: Props) {
  await requireStaff("settings", "/admin/settings");
  const params = await searchParams;
  const tab = params.tab === "log" || params.tab === "users" ? params.tab : "settings";
  const t = await getTranslations("Admin");
  const tabs = (
    <PageTabs
      label={t("nav.settings")}
      items={[
        { key: "settings", label: t("pageTabs.settings"), icon: Settings, href: { pathname: "/admin/settings" }, on: tab === "settings" },
        { key: "users", label: t("pageTabs.users"), icon: Users, href: { pathname: "/admin/settings", query: { tab: "users" } }, on: tab === "users" },
        { key: "log", label: t("pageTabs.log"), short: t("pageTabs.logShort"), icon: ScrollText, href: { pathname: "/admin/settings", query: { tab: "log" } }, on: tab === "log" },
      ]}
    />
  );
  // Users fill the screen (their list scrolls under the tabs); the others are ordinary pages.
  if (tab === "users") return <UsersView searchParams={Promise.resolve(params)} tabs={tabs} />;
  return (
    <div className="flex flex-col gap-5">
      <StickyTabs>{tabs}</StickyTabs>
      {tab === "log" ? <ActivityLogView searchParams={Promise.resolve(params)} /> : <SettingsView />}
    </div>
  );
}
