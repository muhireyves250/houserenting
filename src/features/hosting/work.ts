import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

/** The parts of the work dashboard someone may open (each role sees only its own pages). */
export type WorkArea = "overview" | "desk" | "places" | "orders" | "laundry" | "payout" | "restaurants";

export type WorkRoles = {
  /** Owns places (or was made a place owner by VIIPA). */
  owner: boolean;
  /** Places where they are property manager or receptionist. */
  places: { listingId: string; title: string; role: "MANAGER" | "RECEPTIONIST" }[];
  /** Restaurants they own or work at. */
  restaurants: { id: string; name: string; role: "OWNER" | "MANAGER" | "STAFF" | "DELIVERY" }[];
  /** Has the restaurant owner/manager role (may set up a restaurant). */
  restaurateur: boolean;
  areas: WorkArea[];
  /** Where their dashboard opens. */
  home: string;
};

/** Someone's roles at places and restaurants, and the dashboard pages that go with them. */
export const workRoles = cache(async (userId: string): Promise<WorkRoles> => {
  const [user, owned, places, ownedRestaurants, restaurantJobs] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { isHost: true, isRestaurateur: true } }),
    db.listing.count({ where: { hostId: userId, status: { not: "ARCHIVED" } } }),
    db.placeMember.findMany({ where: { userId, listing: { status: { not: "ARCHIVED" } } }, select: { role: true, listing: { select: { id: true, title: true } } } }),
    db.restaurant.findMany({ where: { ownerId: userId }, select: { id: true, name: true } }),
    db.restaurantMember.findMany({ where: { userId }, select: { role: true, restaurant: { select: { id: true, name: true } } } }),
  ]);
  const owner = Boolean(user?.isHost) || owned > 0;
  const placeJobs = places.map((p) => ({ listingId: p.listing.id, title: p.listing.title, role: p.role }));
  const restaurants = [
    ...ownedRestaurants.map((r) => ({ id: r.id, name: r.name, role: "OWNER" as const })),
    ...restaurantJobs.map((m) => ({ id: m.restaurant.id, name: m.restaurant.name, role: m.role })),
  ];
  const manager = placeJobs.some((p) => p.role === "MANAGER");
  const desk = placeJobs.length > 0;
  const areas: WorkArea[] = [];
  if (owner || manager) areas.push("overview");
  if (desk) areas.push("desk");
  if (owner || manager) areas.push("places", "orders", "laundry");
  else if (desk) areas.push("laundry");
  if (owner) areas.push("payout");
  // Restaurant owners and managers (the role VIIPA gives): their restaurants, or setting the first one up.
  const restaurateur = Boolean(user?.isRestaurateur);
  if (restaurants.length > 0 || restaurateur) areas.push("restaurants");
  const home = areas.includes("overview") ? "/host" : desk ? "/host/desk" : restaurants.length > 0 ? "/host/restaurants" : restaurateur ? "/host/restaurants/new" : "/host";
  return { owner, places: placeJobs, restaurants, restaurateur, areas, home };
});

/** Has any role with a work dashboard. */
export const hasWork = (w: WorkRoles) => w.owner || w.places.length > 0 || w.restaurants.length > 0 || w.restaurateur;

/** Opens a work dashboard page only for roles that have it; others go to their own dashboard start. */
export async function requireWorkArea(area: WorkArea, path: string) {
  const { requireUser } = await import("@/lib/session");
  const { redirect } = await import("@/i18n/navigation");
  const { getLocale } = await import("next-intl/server");
  const user = await requireUser(path);
  const work = await workRoles(user.id);
  // Someone with no role yet may still start as an owner (overview and adding a place).
  const allowed = work.areas.length === 0 ? area === "overview" || area === "places" : work.areas.includes(area);
  if (!allowed) redirect({ href: work.home === path ? "/" : work.home, locale: await getLocale() });
  return { user, work };
}
