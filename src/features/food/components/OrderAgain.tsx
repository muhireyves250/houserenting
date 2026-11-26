"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

/**
 * Puts exactly the same dishes (and quantities, and note) back in the cart and opens the stay's menu with the order
 * already showing, ready to send (prices are checked again there; dishes no longer served are said).
 */
export function OrderAgain({ items, note = null, compact = false }: { items: { menuItemId: string | null; quantity: number }[]; note?: string | null; compact?: boolean }) {
  const t = useTranslations("Food");
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        const cart: Record<string, number> = {};
        for (const i of items) if (i.menuItemId) cart[i.menuItemId] = (cart[i.menuItemId] ?? 0) + i.quantity;
        try {
          localStorage.setItem("sr_cart_stay", JSON.stringify(cart));
          // Open the order as soon as the menu loads, with how many dishes were asked for (to say if some are gone).
          sessionStorage.setItem("sr_again_stay", JSON.stringify({ dishes: items.length, note: note ?? "" }));
        } catch {}
        router.push("/food");
      }}
      aria-label={compact ? t("orderAgain") : undefined}
      className={
        compact
          ? "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/[0.08] px-3 py-2 text-[13px] font-semibold text-primary hover:bg-primary/15"
          : "inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[14px] font-semibold text-ink hover:border-primary"
      }
    >
      <RotateCcw className="size-4" aria-hidden="true" />
      {compact ? t("orderAgainShort") : t("orderAgain")}
    </button>
  );
}
