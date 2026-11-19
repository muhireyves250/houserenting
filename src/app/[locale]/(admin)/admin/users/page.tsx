import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Old link: users are a tab of Settings now. Keeps the search and filters in the link. */
export default async function OldLink({ searchParams }: Props) {
  const query: Record<string, string> = { tab: "users" };
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string") query[k] = v;
  redirect({ href: { pathname: "/admin/settings", query }, locale: await getLocale() });
}
