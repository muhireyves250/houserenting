import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("Home");
  return (
    <h1 className="p-6 text-3xl">
      {t("titleTop")} {t("titleBottom")}
    </h1>
  );
}
