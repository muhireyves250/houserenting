import { LayoutDashboard } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Logo } from "@/components/ui/Logo";
import { HeaderSearch } from "@/features/search/components/HeaderSearch";
import { Link } from "@/i18n/navigation";
import { HeaderFrame } from "./HeaderFrame";
import { HeaderAuthLinks } from "./HeaderAuthLinks";
import { HeaderNav } from "./HeaderNav";
import { LocaleSwitcher } from "./LocaleSwitcher";

export async function SiteHeader({ user }: { user: { name: string; isAdmin?: boolean } | null }) {
  const t = await getTranslations("Nav");

  return (
    <HeaderFrame>
      <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-6 px-6 xl:gap-8">
        <Link href="/" className="shrink-0">
          {/* Icon-only logo; "Space Rental" stays as the accessible name. */}
          <Logo className="transition-colors duration-500 group-data-[overlay=true]/header:text-white [&_svg]:h-9 [&_svg]:w-10" />
        </Link>
        <HeaderNav signedIn={Boolean(user)} />
        <div className="flex flex-1 justify-center">
          <HeaderSearch />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Suspense>
            <LocaleSwitcher />
          </Suspense>
          {user?.isAdmin && (
            <Link
              href="/admin"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-[14px] font-semibold text-white shadow-[0_6px_16px_-8px_rgba(0,87,184,0.9)] transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <LayoutDashboard className="size-4" aria-hidden="true" />
              {t("admin")}
            </Link>
          )}
          {user ? (
            <Link href="/profile" className="rounded-full focus-visible:outline-2 focus-visible:outline-primary">
              <Avatar name={user.name} />
              <span className="sr-only">{t("profile")}</span>
            </Link>
          ) : (
            <HeaderAuthLinks />
          )}
        </div>
      </div>
    </HeaderFrame>
  );
}
