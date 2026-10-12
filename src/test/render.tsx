import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { catalogs } from "@/i18n/messages";
import type { AppLocale } from "@/i18n/routing";

export function renderWithIntl(ui: ReactElement, locale: AppLocale = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="Africa/Kigali">
      {ui}
    </NextIntlClientProvider>,
  );
}
