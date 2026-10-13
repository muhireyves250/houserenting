import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/ui/Logo";
import { Link } from "@/i18n/navigation";
import { FooterLanguages } from "./FooterLanguages";
import { NAV_ITEMS, navHref, type NavHref } from "./nav-items";

type SearchHref = { pathname: "/search"; query: Record<string, string> };
type FooterKey = "kigali" | "musanze" | "rubavu" | "karongi" | "shortStays" | "longStays";

const search = (query: Record<string, string>): SearchHref => ({ pathname: "/search", query });

const EXPLORE: { key: FooterKey; href: SearchHref }[] = [
  { key: "kigali", href: search({ mode: "short", location: "Kigali" }) },
  { key: "musanze", href: search({ mode: "short", location: "Musanze" }) },
  { key: "rubavu", href: search({ mode: "short", location: "Rubavu" }) },
  { key: "karongi", href: search({ mode: "short", location: "Karongi" }) },
];

const STAYS: { key: FooterKey; href: SearchHref }[] = [
  { key: "shortStays", href: search({ mode: "short" }) },
  { key: "longStays", href: search({ mode: "long" }) },
];

const EASE = "ease-[cubic-bezier(0.32,0.72,0,1)]";

// Underline slides in from the left on hover.
const LINK = `bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 text-[15px] text-white/70 transition-[background-size,color] duration-500 ${EASE} hover:bg-[length:100%_1px] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`;

function Column({ title, links }: { title: string; links: { key: string; label: string; href: NavHref | SearchHref }[] }) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-[11px] font-semibold tracking-[0.18em] text-white/45 uppercase">{title}</h2>
      <ul className="flex flex-col gap-3.5">
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
  const links = (items: { key: FooterKey; href: SearchHref }[]) => items.map(({ key, href }) => ({ key, label: t(key), href }));

  return (
    // Deep brand navy, echoing the bottom of the hero. Phones get room above the tab bar.
    <footer aria-label={t("label")} className="site-footer relative isolate overflow-hidden bg-[#001a3d] pb-24 text-white md:pb-0">
      {/* Soft brand glows. */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_0%_0%,rgba(0,87,184,0.45),transparent_60%),radial-gradient(40%_60%_at_100%_100%,rgba(0,87,184,0.25),transparent_70%)]"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl px-4 md:px-6">
        {/* Headline band */}
        <div className="flex flex-col gap-6 border-b border-white/10 py-12 md:flex-row md:items-end md:justify-between md:py-16">
          <div className="flex max-w-xl flex-col gap-3">
            <p className="font-display text-3xl leading-tight font-bold tracking-[-0.03em] md:text-[40px] md:leading-[1.1]">{tAuth("tagline")}</p>
            <p className="text-[15px] leading-6 text-white/65">{t("about")}</p>
          </div>
          <Link
            href="/"
            className={`group/cta inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-white py-3 pr-4 pl-6 text-[15px] font-semibold text-primary shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] transition-[transform,box-shadow] duration-500 ${EASE} hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-12px_rgba(0,0,0,0.7)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white`}
          >
            {t("startSearching")}
            <span className={`flex size-7 items-center justify-center rounded-full bg-primary text-white transition-transform duration-500 ${EASE} group-hover/cta:translate-x-1`}>
              <ArrowRight className="size-4" aria-hidden="true" />
            </span>
          </Link>
        </div>

        {/* Links */}
        <div className="grid gap-12 py-12 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:py-14">
          <div className="flex flex-col gap-4">
            <Link href="/" className="w-fit rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
              <Logo withWordmark className="text-white [&_svg]:h-8 [&_svg]:w-9" wordmarkClassName="font-display text-xl text-white" />
            </Link>
            <p className="inline-flex items-center gap-2 text-sm text-white/55">
              {/* Rwanda flag colours. */}
              <span className="flex h-3 w-5 overflow-hidden rounded-[2px]" aria-hidden="true">
                <span className="w-1/2 bg-[#00a1de]" />
                <span className="w-1/4 bg-[#fad201]" />
                <span className="w-1/4 bg-[#20603d]" />
              </span>
              {t("madeIn")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 md:contents">
            <Column title={t("explore")} links={links(EXPLORE)} />
            <Column title={t("stays")} links={links(STAYS)} />
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

        {/* Bottom bar */}
        <div className="flex flex-col gap-5 border-t border-white/10 py-6 md:flex-row md:items-center md:justify-between">
          <p className="text-[13px] text-white/55">{t("rights", { year })}</p>
          <FooterLanguages />
        </div>
      </div>
    </footer>
  );
}
