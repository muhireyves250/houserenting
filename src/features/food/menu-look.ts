import { createElement } from "react";
import { Backpack, Beef, Coffee, Croissant, CupSoda, Fish, IceCreamCone, Salad, Sandwich, Soup, UtensilsCrossed, type LucideIcon } from "lucide-react";

/** Meal order for menu sections: breakfast first, drinks last; sections it doesn't know sit in the middle. */
const ORDER = [
  /breakfast|petit|mu gitondo/i,
  /starter|entr|soup|soupe/i,
  /packed|box|trek/i,
  /lunch|déjeuner|saa sita|ku manywa/i,
  /dinner|dîner|ijoro|nimugoroba/i,
  /main|plat/i,
  /grill|meat|viande|inyama/i,
  /fish|poisson|ifi/i,
  /side|accomp/i,
  /dessert|sweet/i,
  /drink|boisson|ibinyobwa/i,
];

export function sectionRank(name: string): number {
  const i = ORDER.findIndex((re) => re.test(name));
  return i < 0 ? 6.5 : i;
}

/** A picture for dishes without a photo, from their section (or name). */
function pickIcon(section: string, name: string): LucideIcon {
  const text = `${section} ${name}`;
  if (/drink|juice|soda|boisson|ibinyobwa/i.test(text)) return /coffee|tea|chocolate|café|thé/i.test(text) ? Coffee : CupSoda;
  if (/coffee|tea|chocolate/i.test(text)) return Coffee;
  if (/breakfast|petit|pancake|rolex/i.test(text)) return Croissant;
  if (/packed|box/i.test(text)) return Backpack;
  if (/fish|tilapia|sambaza|poisson/i.test(text)) return Fish;
  if (/salad|side|accomp|plantain|avocado/i.test(text)) return Salad;
  if (/wrap|sandwich|burger/i.test(text)) return Sandwich;
  if (/soup|stew|curry|dinner/i.test(text)) return Soup;
  if (/beef|brochette|grill|meat|chicken/i.test(text)) return Beef;
  if (/dessert|sweet|ice/i.test(text)) return IceCreamCone;
  return UtensilsCrossed;
}

/** The icon for a dish without a photo. */
export function dishIcon(section: string, name: string, className: string) {
  return createElement(pickIcon(section, name), { className, strokeWidth: 1.5, "aria-hidden": true });
}
