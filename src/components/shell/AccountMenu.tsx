"use client";

import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { Link } from "@/i18n/navigation";

/**
 * Computers: the avatar opens the account area (no floating menu): every account page and Log out are in its
 * sidebar on the left.
 */
export function AccountMenu({ name, image }: { name: string; image?: string | null }) {
  const t = useTranslations("Nav");
  return (
    <Link href="/profile" aria-label={t("accountMenu")} className="rounded-full focus-visible:outline-2 focus-visible:outline-primary">
      <Avatar name={name} image={image} />
    </Link>
  );
}
