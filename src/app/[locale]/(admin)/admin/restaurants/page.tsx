import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Old link: restaurants are a tab of the Food page now. Keeps the filters and page in the link. */
export default async function OldLink({ searchParams }: Props) {
  const query: Record<string, string> = { tab: "restaurants" };
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string") query[k] = v;
  redirect({ href: { pathname: "/admin/orders", query }, locale: await getLocale() });
}
