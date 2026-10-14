import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { LocaleSwitcher } from "@/components/shell/LocaleSwitcher";
import { LogoMark } from "@/components/ui/Logo";
import { Link } from "@/i18n/navigation";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const tNav = await getTranslations("Nav");

  return (
    <div className="grid min-h-dvh md:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-primary p-10 text-white md:flex">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark className="h-8 w-9 text-primary-soft" />
          <span className="text-xl font-bold">Space Rental</span>
        </Link>
        <p className="text-sm text-primary-soft">Kigali · Musanze · Rubavu · Huye</p>
      </aside>
      <section className="flex flex-col bg-surface px-6 py-6 md:px-16 md:py-10">
        <div className="mb-10 flex items-center justify-between">
          <Link href="/" aria-label={tNav("back")} className="text-ink">
            <ChevronLeft className="size-6" aria-hidden="true" />
          </Link>
          <Suspense>
            <LocaleSwitcher />
          </Suspense>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col md:justify-center">{children}</div>
      </section>
    </div>
  );
}
