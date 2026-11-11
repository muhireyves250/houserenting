"use client";

import { Download, Share, SquarePlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { canPrompt, isInstalled, isIOS, promptInstall, subscribeInstall } from "./install-store";

/**
 * "Install the app": opens the browser's install window where there is one (Android, Chrome, Edge); on iPhone and
 * iPad, and in browsers without one, shows how to add VIIPA to the home screen. Hidden once installed.
 */
const DISMISSED = "viipa-install-dismissed";

export function InstallApp({ className, variant = "button" }: { className?: string; variant?: "button" | "row" | "banner" }) {
  const t = useTranslations("Install");
  const promptReady = useSyncExternalStore(subscribeInstall, canPrompt, () => false);
  const [mounted, setMounted] = useState(false);
  const [help, setHelp] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
      try {
        setDismissed(localStorage.getItem(DISMISSED) === "1");
      } catch {}
    });
  }, []);
  if (!mounted || isInstalled() || (variant === "banner" && dismissed)) return null;
  const ios = isIOS();
  const open = async () => {
    if (promptReady) await promptInstall();
    else setHelp((h) => !h);
  };

  if (variant === "banner") {
    return (
      <div className={cn("rounded-2xl bg-surface p-3 ring-1 ring-line", className)}>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny static brand icon */}
          <img src="/brand/icon-192.png" alt="" className="size-11 shrink-0 rounded-xl ring-1 ring-line" />
          <span className="min-w-0 flex-1 text-[14px] leading-5">
            <b className="block font-semibold text-ink">{t("bannerTitle")}</b>
            <span className="text-muted">{t("bannerBody")}</span>
          </span>
          <button type="button" onClick={open} className="shrink-0 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white">
            {t("install")}
          </button>
          <button
            type="button"
            aria-label={t("close")}
            onClick={() => {
              setDismissed(true);
              try {
                localStorage.setItem(DISMISSED, "1");
              } catch {}
            }}
            className="shrink-0 rounded-full p-1.5 text-muted hover:bg-canvas"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        {help && <InstallHelp ios={ios} />}
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={open}
        className={cn(
          variant === "button"
            ? "inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-primary shadow-sm hover:bg-primary-soft"
            : "flex w-full items-center gap-3 py-3 text-left text-[15px] text-ink",
        )}
      >
        <Download className={variant === "button" ? "size-4" : "size-5"} aria-hidden="true" />
        {t("cta")}
      </button>
      {help && <InstallHelp ios={ios} onClose={() => setHelp(false)} />}
    </div>
  );
}

/** How to install where the browser has no install window (iPhone/iPad, or the menu elsewhere). */
function InstallHelp({ ios, onClose }: { ios: boolean; onClose?: () => void }) {
  const t = useTranslations("Install");
  return (
    <div role="dialog" aria-label={t("cta")} className="relative mt-3 max-w-sm rounded-2xl bg-white p-4 text-[14px] text-ink shadow-lg ring-1 ring-line">
      {onClose && (
        <button type="button" onClick={onClose} aria-label={t("close")} className="absolute top-2 right-2 rounded-full p-1.5 text-muted hover:bg-canvas">
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
      <p className="mb-2 pr-6 font-semibold">{ios ? t("iosTitle") : t("otherTitle")}</p>
      {ios ? (
        <ol className="flex flex-col gap-2">
          <li className="flex items-center gap-2">
            <Share className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {t("iosStep1")}
          </li>
          <li className="flex items-center gap-2">
            <SquarePlus className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {t("iosStep2")}
          </li>
        </ol>
      ) : (
        <p className="text-ink/80">{t("otherBody")}</p>
      )}
    </div>
  );
}
