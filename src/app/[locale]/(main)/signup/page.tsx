import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/session";
import { AuthModal } from "@/features/auth/components/AuthModal";
import { HomeContent } from "@/features/home/HomeContent";
import { safeNextPath } from "@/lib/safe-redirect";

// Direct visit (refresh, email link, redirect from a protected page): the modal over the home page.
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = safeNextPath((await searchParams).next);
  // Already signed in: nothing to do here.
  if (await getCurrentUser()) redirect({ href: next, locale: await getLocale() });
  return (
    <>
      <HomeContent />
      <AuthModal initialMode="signup" next={next} standalone />
    </>
  );
}
