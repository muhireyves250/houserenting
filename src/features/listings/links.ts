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

/** The listing ID from "/listings/<id>" or "/listings/<id>-<words>" (IDs contain no dashes). */
export function listingIdFromParam(param: string): string {
  return decodeURIComponent(param).split("-")[0] ?? "";
}
