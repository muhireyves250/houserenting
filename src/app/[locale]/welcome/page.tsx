import { Welcome } from "@/features/onboarding/components/Welcome";

export default async function WelcomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = (await searchParams).next;
  return <Welcome next={typeof next === "string" ? next : "/"} />;
}
