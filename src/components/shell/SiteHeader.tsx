import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { HeaderSearch } from "@/features/search/components/HeaderSearch";
import { Link } from "@/i18n/navigation";
import { HeaderNav } from "./HeaderNav";
import { LocaleSwitcher } from "./LocaleSwitcher";

export async function SiteHeader({ user }: { user: { name: string } | null }) {
  const t = await getTranslations("Nav");

  return (
    <header className="group/header sticky top-0 z-40 hidden border-b border-line bg-surface/95 backdrop-blur md:block">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-10 px-6">
        <Link href="/" className="shrink-0">
          <Logo withWordmark />
        </Link>
        {/* When the compact search pill is showing, narrower screens drop the text links to make room. */}
        <div className="max-[1439px]:group-has-[[data-header-search]]/header:hidden">
          <HeaderNav />
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
            <>
              <Link href="/login" className={buttonClasses({ variant: "ghost" })}>
                {t("login")}
              </Link>
              <Link href="/signup" className={buttonClasses()}>
                {t("signup")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
