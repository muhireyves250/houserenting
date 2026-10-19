"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

/** Puts the same dishes back in the restaurant's cart and opens its menu (prices are checked again there). */
export function OrderAgain({ restaurantId, items }: { restaurantId: string; items: { menuItemId: string | null; quantity: number }[] }) {
  const t = useTranslations("Food");
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        const cart = Object.fromEntries(items.filter((i) => i.menuItemId).map((i) => [i.menuItemId!, i.quantity]));
        try {
          localStorage.setItem(`sr_cart_${restaurantId}`, JSON.stringify(cart));
        } catch {}
        router.push(`/restaurants/${restaurantId}`);
      }}
      className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[14px] font-semibold text-ink hover:border-primary"
    >
      <RotateCcw className="size-4" aria-hidden="true" />
      {t("orderAgain")}
    </button>
  );
}
