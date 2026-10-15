/** "Sunny Studio, Kimihurura!" → "sunny-studio-kimihurura" (ASCII, for readable links). */
export function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

/**
 * A place's permanent link: the ID never changes and decides which place opens; the words after it only make the
 * link readable, so links shared before a title change keep working. It never carries booking or personal data.
 */
export function listingPath(id: string, title: string): string {
  const slug = slugify(title);
  return slug ? `/listings/${id}-${slug}` : `/listings/${id}`;
}

/**
 * IDs the link could stand for, longest first: "/listings/<id>" or "/listings/<id>-<words>". Some IDs contain dashes
 * themselves (e.g. "seed-karongi-cottage"), so every dash is a possible end of the ID; the caller keeps the longest
 * that exists.
 */
export function listingIdCandidates(param: string): string[] {
  const value = decodeURIComponent(param);
  const parts = value.split("-");
  return parts.map((_, i) => parts.slice(0, parts.length - i).join("-")).filter(Boolean);
}
