import { HomeContent } from "@/features/home/HomeContent";
import { homeKind, homeTypeFilter } from "@/features/home/sections";

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <HomeContent type={homeTypeFilter(params.type)} kind={homeKind(params.kind)} />;
}
