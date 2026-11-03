import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

/** Old restaurant links: food is ordered from the guest's own stay. */
export default async function RestaurantPage() {
  redirect({ href: "/food", locale: await getLocale() });
}
