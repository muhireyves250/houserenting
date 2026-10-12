import { useLocale, useTranslations } from "next-intl";
import { discountedPrice, type Rate } from "@/features/listings/pricing";
import { formatRWF } from "@/lib/format";
import { cn } from "@/lib/cn";

export function PriceTag({ rate, discountPercent, className }: { rate: Rate; discountPercent: number | null; className?: string }) {
  const t = useTranslations("Listings");
  const locale = useLocale();
  const price = discountedPrice(rate.price, discountPercent);
  const discounted = price !== rate.price;

  return (
    <div className={cn("flex items-baseline gap-2", className)}>
      <span className="text-lg font-bold text-ink">{formatRWF(price, locale)}</span>
      <span className="text-sm text-muted">{t(`perUnit.${rate.unit}`)}</span>
      {discounted && (
        <>
          <s className="text-sm text-muted" aria-label={t("oldPrice")}>
            {formatRWF(rate.price, locale)}
          </s>
          <span className="ml-auto rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
            {t("discount", { percent: discountPercent ?? 0 })}
          </span>
        </>
      )}
    </div>
  );
}
