import { getRequestConfig } from "next-intl/server";
import { catalogs } from "./messages";
import { toAppLocale } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = toAppLocale(await requestLocale);
  return { locale, messages: catalogs[locale], timeZone: "Africa/Kigali" };
});
