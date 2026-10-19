import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/cn";
import type { Fulfilment, OrderStatus } from "../rules";

/** Where the order is: the steps for its kind of service, done ones ticked, the current one highlighted. */
export async function OrderProgress({ status, fulfilment }: { status: OrderStatus; fulfilment: Fulfilment }) {
  const t = await getTranslations("Food");
  const steps: OrderStatus[] = ["PLACED", "ACCEPTED", "PREPARING", "READY", ...(fulfilment === "DELIVERY" ? (["OUT_FOR_DELIVERY"] as const) : []), "DELIVERED"];
  const at = steps.indexOf(status);
  return (
    <ol className="grid gap-0" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((step, i) => {
        const done = i < at || status === "DELIVERED";
        const current = i === at && status !== "DELIVERED";
        return (
          <li key={step} className="relative flex flex-col items-center gap-1.5 text-center">
            {i > 0 && <span aria-hidden="true" className={cn("absolute top-3.5 right-1/2 h-0.5 w-full -translate-y-1/2", i <= at ? "bg-primary" : "bg-line")} />}
            <span
              className={cn(
                "relative z-10 flex size-7 items-center justify-center rounded-full text-[12px] font-bold",
                done ? "bg-primary text-white" : current ? "bg-primary text-white ring-4 ring-primary/20 motion-safe:animate-pulse" : "bg-surface text-muted ring-1 ring-line",
              )}
            >
              {done ? <Check className="size-4" aria-hidden="true" /> : i + 1}
            </span>
            <span className={cn("text-[11px] leading-tight md:text-[12px]", current ? "font-bold text-ink" : done ? "text-ink" : "text-muted")}>{t(`status.${step}`)}</span>
          </li>
        );
      })}
    </ol>
  );
}
