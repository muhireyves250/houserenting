import { useTranslations } from "next-intl";
import { Logo } from "@/components/ui/Logo";
import { Link } from "@/i18n/navigation";
import { FooterLanguages } from "./FooterLanguages";
import { NAV_ITEMS, navHref, type NavHref } from "./nav-items";

type SearchHref = { pathname: "/search"; query: Record<string, string> };

const EXPLORE: { key: "kigali" | "musanze" | "rubavu" | "longStays"; href: SearchHref }[] = [
  { key: "kigali", href: { pathname: "/search", query: { mode: "short", location: "Kigali" } } },
  { key: "musanze", href: { pathname: "/search", query: { mode: "short", location: "Musanze" } } },
  { key: "rubavu", href: { pathname: "/search", query: { mode: "short", location: "Rubavu" } } },
  { key: "longStays", href: { pathname: "/search", query: { mode: "long" } } },
];

// Underline slides in from the left on hover.
const LINK =
  "bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 text-sm text-ink/75 transition-[background-size,color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[length:100%_1px] hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function Column({ title, links }: { title: string; links: { key: string; label: string; href: NavHref | SearchHref }[] }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xs font-bold tracking-[0.14em] text-ink/55 uppercase">{title}</h2>
      <ul className="flex flex-col gap-3">
        {links.map(({ key, label, href }) => (
          <li key={key}>
            <Link href={href} className={LINK}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Site-wide footer. Account links open the login modal for signed-out visitors, like the header. */
export function SiteFooter({ signedIn, year = new Date().getFullYear() }: { signedIn: boolean; year?: number }) {
  const t = useTranslations("Footer");
  const tNav = useTranslations("Nav");
  const tAuth = useTranslations("Auth");

  return (
    // Phones: extra bottom padding so the tab bar never covers the footer.
    <footer aria-label={t("label")} className="border-t border-line bg-surface pb-24 md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-[1.6fr_1fr_1fr] md:gap-12 md:px-6 md:py-16">
        <div className="flex max-w-sm flex-col gap-4">
          <Link href="/" className="w-fit rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
            <Logo withWordmark className="[&_svg]:h-8 [&_svg]:w-9" wordmarkClassName="font-display text-xl" />
          </Link>
          <p className="font-display text-lg font-bold tracking-[-0.02em] text-ink">{tAuth("tagline")}</p>
          <p className="text-sm leading-6 text-muted">{t("about")}</p>
        </div>
        <div className="grid grid-cols-2 gap-10 md:contents">
          <Column title={t("explore")} links={EXPLORE.map(({ key, href }) => ({ key, label: t(key), href }))} />
          <Column
            title={t("account")}
            links={NAV_ITEMS.filter((item) => item.key !== "search").map(({ key, href }) => ({
              key,
              label: tNav(key),
              href: navHref(href, signedIn),
            }))}
          />
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-6">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
            <span>{t("rights", { year })}</span>
            <span aria-hidden="true" className="max-sm:hidden">
              ·
            </span>
            <span>{t("madeIn")}</span>
          </p>
          <FooterLanguages />
        </div>
      </div>
    </footer>
  );
}
