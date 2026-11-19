import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Old link: promoters are a tab of Promotions now. Keeps the filters and page in the link. */
export default async function OldLink({ searchParams }: Props) {
  const query: Record<string, string> = { tab: "promoters" };
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string") query[k] = v;
  redirect({ href: { pathname: "/admin/promotions", query }, locale: await getLocale() });
}
