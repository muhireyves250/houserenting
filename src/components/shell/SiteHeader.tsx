import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/ui/Logo";
import { HeaderSearch } from "@/features/search/components/HeaderSearch";
import { Link } from "@/i18n/navigation";
import { HeaderFrame } from "./HeaderFrame";
import { HeaderNav } from "./HeaderNav";
import { LocaleSwitcher } from "./LocaleSwitcher";

export async function SiteHeader({ user }: { user: { name: string } | null }) {
  const t = await getTranslations("Nav");

  return (
    <HeaderFrame>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-10 px-6">
        <Link href="/" className="shrink-0">
          {/* Icon-only logo; "Space Rental" stays as the accessible name. */}
          <Logo className="transition-colors duration-500 group-data-[overlay=true]/header:text-white [&_svg]:h-9 [&_svg]:w-10" />
        </Link>
        {/* When the compact search pill is showing, narrower screens drop the text links to make room. */}
        <div className="max-[1535px]:group-has-[[data-header-search]]/header:hidden">
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
              <Link
                href="/login"
                className={cn(
                  buttonClasses({ variant: "ghost" }),
                  // Outlined blue pill; sky-blue outline over the hero so it stays visible on the video.
                  "border border-primary text-[15px] tracking-[0.01em] text-primary hover:bg-primary/[0.06] hover:text-primary",
                  "group-data-[overlay=true]/header:border-[#8cc0ff] group-data-[overlay=true]/header:text-white group-data-[overlay=true]/header:hover:bg-white/10 group-data-[overlay=true]/header:hover:text-white",
                )}
              >
                {t("login")}
              </Link>
              {/* Blue pill when solid; crisp white pill with blue text over the hero. */}
              <Link
                href="/signup"
                className={cn(
                  buttonClasses(),
                  "text-[15px] tracking-[0.01em] shadow-[0_8px_20px_-10px_rgba(0,87,184,0.7)] transition-[background-color,color,box-shadow] duration-500",
                  "group-data-[overlay=true]/header:bg-white group-data-[overlay=true]/header:text-primary group-data-[overlay=true]/header:shadow-[0_8px_24px_-10px_rgba(0,20,60,0.5)] group-data-[overlay=true]/header:hover:bg-white/90",
                )}
              >
                {t("signup")}
              </Link>
            </>
          )}
        </div>
      </div>
    </HeaderFrame>
  );
}
