import { AuthModal } from "@/features/auth/components/AuthModal";
import { HomeContent } from "@/features/home/HomeContent";
import { safeNextPath } from "@/lib/safe-redirect";

// Direct visit (refresh, email link, redirect from a protected page): the modal over the home page.
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = safeNextPath((await searchParams).next);
  return (
    <>
      <HomeContent />
      <AuthModal initialMode="forgot" next={next} standalone />
    </>
  );
}
