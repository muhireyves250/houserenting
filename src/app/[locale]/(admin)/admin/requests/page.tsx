import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

/** Old link: guest requests are on the bookings page now. */
export default async function AdminRequestsPage() {
  redirect({ href: "/admin/bookings", locale: await getLocale() });
}
