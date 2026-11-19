import { HomeContent } from "@/features/home/HomeContent";
import { homeTypeFilter } from "@/features/home/sections";

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <HomeContent type={homeTypeFilter((await searchParams).type)} />;
}
