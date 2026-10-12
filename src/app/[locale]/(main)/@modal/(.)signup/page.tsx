import { AuthModal } from "@/features/auth/components/AuthModal";
import { safeNextPath } from "@/lib/safe-redirect";

// Intercepts /signup when opened from the site (soft navigation): shows the modal over the current page.
export default async function SignupModal({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = safeNextPath((await searchParams).next);
  return <AuthModal initialMode="signup" next={next} />;
}
