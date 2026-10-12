"use client";

import { useTranslations } from "next-intl";
import { buttonClasses } from "@/components/ui/Button";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * Log in / Sign up for signed-out visitors. From inside the site these open the auth modal
 * (intercepted routes); `next` brings the user back to the page they were on.
 */
export function HeaderAuthLinks() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const query = pathname !== "/" ? { next: pathname } : undefined;

  return (
    <>
      <Link
        href={{ pathname: "/login", query }}
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
        href={{ pathname: "/signup", query }}
        className={cn(
          buttonClasses(),
          "text-[15px] tracking-[0.01em] shadow-[0_8px_20px_-10px_rgba(0,87,184,0.7)] transition-[background-color,color,box-shadow] duration-500",
          "group-data-[overlay=true]/header:bg-white group-data-[overlay=true]/header:text-primary group-data-[overlay=true]/header:shadow-[0_8px_24px_-10px_rgba(0,20,60,0.5)] group-data-[overlay=true]/header:hover:bg-white/90",
        )}
      >
        {t("signup")}
      </Link>
    </>
  );
}
