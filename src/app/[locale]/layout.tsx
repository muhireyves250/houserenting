import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { SmoothScroll } from "@/components/shell/SmoothScroll";
import { routing } from "@/i18n/routing";
import "../globals.css";

// UI typeface: Geist (variable weights), clean and modern; latin-ext covers French accents.
const brandSans = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-brand", display: "swap" });

export const viewport: Viewport = { themeColor: "#0057b8" };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: { default: t("title"), template: `%s · ${t("title")}` }, description: t("description") };
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} className={brandSans.variable}>
      <body className="min-h-dvh bg-canvas font-sans text-ink antialiased">
        <SmoothScroll />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
