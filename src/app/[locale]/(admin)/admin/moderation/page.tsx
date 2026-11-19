import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

type Props = { searchParams: Promise<{ show?: string }> };

/** Old link (notifications, bookmarks): reviews and questions are a tab of Support and reviews now. */
export default async function ModerationRedirect({ searchParams }: Props) {
  const show = (await searchParams).show;
  redirect({ href: { pathname: "/admin/support", query: show === "published" ? { tab: "reviews", show } : { tab: "reviews" } }, locale: await getLocale() });
}
