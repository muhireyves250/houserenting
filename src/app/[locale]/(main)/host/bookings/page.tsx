import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

/** Old owner-portal links: only VIIPA staff see bookings now. */
export default async function HostBookingsPage() {
  redirect({ href: "/host", locale: await getLocale() });
}
