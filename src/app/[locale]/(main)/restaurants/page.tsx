import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

/** Clients don't choose restaurants: food comes from the kitchen where they're staying. */
export default async function RestaurantsPage() {
  redirect({ href: "/food", locale: await getLocale() });
}
