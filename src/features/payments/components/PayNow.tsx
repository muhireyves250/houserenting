"use client";

import { LoaderCircle, Smartphone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition, type ReactNode } from "react";
import { parseMobileMoney, type MoMoProvider } from "@/features/listings/mobile-money";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { requestPaymentAction } from "../actions";

const PROVIDERS: { id: MoMoProvider; badge: ReactNode }[] = [
  { id: "mtn", badge: <span className="flex h-7 w-11 items-center justify-center rounded-md bg-[#ffcb05] text-[10px] font-black tracking-tight text-black">MTN</span> },
  { id: "airtel", badge: <span className="flex h-7 w-11 items-center justify-center rounded-md bg-[#e40000] text-[10px] font-bold text-white">airtel</span> },
];

/**
 * "Pay now" on a booking waiting for payment: choose MTN or Airtel and the number, then approve on the phone.
 * The number is used for this request only (not stored). The page checks every few seconds until the provider confirms.
 */
export function PayNow({ reference, amount, method, connected }: { reference: string; amount: number; method: MoMoProvider | null; connected: boolean }) {
  const t = useTranslations("Pay");
  const tListings = useTranslations("Listings");
  const locale = useLocale();
  const router = useRouter();
  const numberId = useId();
  const [provider, setProvider] = useState<MoMoProvider>(method ?? "mtn");
  const [number, setNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [pending, start] = useTransition();

  // While the guest approves on their phone, refresh the booking so the confirmation shows as soon as it lands.
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => router.refresh(), 3000);
    const stop = setTimeout(() => setWaiting(false), 3 * 60_000);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [waiting, router]);

  if (!connected) {
    return <p className="text-[15px] text-ink/80">{t("notConnected")}</p>;
  }

  function pay() {
    const parsed = parseMobileMoney(provider, number);
    if (!parsed.ok) {
      setError(parsed.error === "invalid" ? tListings("momoInvalid") : provider === "mtn" ? tListings("momoNetworkMtn") : tListings("momoNetworkAirtel"));
      return;
    }
    setError(null);
    start(async () => {
      const result = await requestPaymentAction(reference, provider, number);
      if (result.ok) setWaiting(true);
      else setError(t(`error.${result.error}`));
    });
  }

  if (waiting) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 py-4 text-center">
        <span className="relative flex size-16 items-center justify-center rounded-full bg-primary/[0.08] text-primary">
          <Smartphone className="size-7" aria-hidden="true" />
          <LoaderCircle className="absolute size-16 animate-spin text-primary/40" strokeWidth={1.2} aria-hidden="true" />
        </span>
        <p className="text-[15px] font-semibold text-ink">{t("approveOnPhone")}</p>
        <p className="text-[13px] text-muted">{t("approveHint", { amount: formatRWF(amount, locale) })}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label={t("method")} className="grid grid-cols-2 gap-2">
        {PROVIDERS.map(({ id, badge }) => (
          <label
            key={id}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
              provider === id ? "border-primary bg-primary/[0.04]" : "border-line hover:border-primary/60",
            )}
          >
            <input type="radio" name="pay-provider" value={id} checked={provider === id} onChange={() => setProvider(id)} className="sr-only" />
            {badge}
            <span className="text-[13px] font-semibold text-ink">{id === "mtn" ? tListings("mtnMomo") : tListings("airtelMoney")}</span>
          </label>
        ))}
      </div>
      <div className={cn("flex flex-col gap-0.5 rounded-xl border px-4 py-3 focus-within:border-ink max-md:focus-within:border-primary", error ? "border-danger" : "border-line-strong")}>
        <label htmlFor={numberId} className="text-xs font-semibold text-muted">
          {tListings("momoNumber")}
        </label>
        <input
          id={numberId}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="078 123 4567"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          aria-invalid={Boolean(error)}
          className="w-full bg-transparent text-[15px] text-ink outline-none"
        />
      </div>
      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={pay}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-[#0a6fe0] py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,87,184,0.8)] transition-[filter,transform] duration-300 hover:brightness-110 active:scale-[0.98] disabled:opacity-70"
      >
        {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
        {t("pay", { amount: formatRWF(amount, locale) })}
      </button>
    </div>
  );
}
