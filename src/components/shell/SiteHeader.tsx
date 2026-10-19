import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { MessageSquare, Plus } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { HeaderSearch } from "@/features/search/components/HeaderSearch";
import { Link } from "@/i18n/navigation";
import { AccountMenu } from "./AccountMenu";
import { HeaderFrame } from "./HeaderFrame";
import { HeaderAuthLinks } from "./HeaderAuthLinks";
import { HeaderNav } from "./HeaderNav";
import { LocaleSwitcher } from "./LocaleSwitcher";

export async function SiteHeader({ user, orders = false }: { user: { name: string; image?: string | null } | null; orders?: boolean }) {
  const t = await getTranslations("Nav");

  return (
    <HeaderFrame>
      <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-6 px-6 xl:gap-8">
        <Link href="/" className="shrink-0">
          {/* Icon-only logo; "Space Rental" stays as the accessible name. */}
          <Logo className="transition-colors duration-500 group-data-[overlay=true]/header:text-white [&_svg]:h-9 [&_svg]:w-10" />
        </Link>
        <HeaderNav signedIn={Boolean(user)} orders={orders} />
        <div className="flex flex-1 justify-center">
          <HeaderSearch />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Suspense>
            <LocaleSwitcher />
          </Suspense>
          <Link
            href={user ? "/host/listings/new" : { pathname: "/login", query: { next: "/host/listings/new" } }}
            title={t("addPlace")}
            className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-[14px] font-semibold whitespace-nowrap text-ink/80 transition-colors hover:bg-primary/[0.08] hover:text-ink lg:inline-flex group-data-[overlay=true]/header:text-white group-data-[overlay=true]/header:hover:bg-white/15"
          >
            <Plus className="size-4" aria-hidden="true" />
            {/* Laptops: just the + (named for screen readers and on hover); wide screens: the words too. */}
            <span className="sr-only 2xl:not-sr-only">{t("addPlace")}</span>
          </Link>
          {user ? (
            <>
              <Link
                href="/chats"
                aria-label={t("messages")}
                className="flex size-10 items-center justify-center rounded-full text-ink/80 transition-colors hover:bg-primary/[0.08] hover:text-ink group-data-[overlay=true]/header:text-white group-data-[overlay=true]/header:hover:bg-white/15"
              >
                <MessageSquare className="size-5" aria-hidden="true" />
              </Link>
              <AccountMenu name={user.name} image={user.image} />
            </>
          ) : (
            <HeaderAuthLinks />
          )}
        </div>
      </div>
    </HeaderFrame>
  );
}
