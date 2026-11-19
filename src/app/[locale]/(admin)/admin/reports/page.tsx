import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Old link: reports are a tab of Money and reports now. Keeps the filters in the link. */
export default async function OldLink({ searchParams }: Props) {
  const query: Record<string, string> = { tab: "reports" };
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string") query[k] = v;
  redirect({ href: { pathname: "/admin/money", query }, locale: await getLocale() });
}
