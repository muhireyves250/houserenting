import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import { catalogs } from "@/i18n/messages";
import type { AppLocale } from "@/i18n/routing";

/** Renders with translations; passed as a wrapper so `rerender` keeps the provider. */
export function renderWithIntl(ui: ReactElement, locale: AppLocale = "en") {
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="Africa/Kigali">
        {children}
      </NextIntlClientProvider>
    ),
  });
}
