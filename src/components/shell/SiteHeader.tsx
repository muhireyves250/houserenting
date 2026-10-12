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

export async function SiteHeader({ user }: { user: { name: string } | null }) {
  const t = await getTranslations("Nav");

  return (
    <HeaderFrame>
      <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-10 px-6">
        <Link href="/" className="shrink-0">
          {/* Icon-only logo; "Space Rental" stays as the accessible name. */}
          <Logo className="transition-colors duration-500 group-data-[overlay=true]/header:text-white [&_svg]:h-9 [&_svg]:w-10" />
        </Link>
        {/* When the compact search pill is showing, narrower screens drop the text links to make room. */}
        <div className="max-[1535px]:group-has-[[data-header-search]]/header:hidden">
          <HeaderNav signedIn={Boolean(user)} />
        </div>
        <div className="flex flex-1 justify-center">
          <HeaderSearch />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Suspense>
            <LocaleSwitcher />
          </Suspense>
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
