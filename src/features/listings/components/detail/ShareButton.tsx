"use client";

import { Check, Copy, Ellipsis, Mail, MessageSquare, Share } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { PlacePreview, type PlacePreviewData } from "./PlacePreview";

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3 1 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2 .7 2.8.6.4-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.2Z" />
  </svg>
);
const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
    <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z" />
  </svg>
);
const XIcon = () => (
  <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor" aria-hidden="true">
    <path d="M17.8 3h3.1l-6.8 7.7 8 10.3h-6.2l-4.9-6.3L5.4 21H2.3l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" />
  </svg>
);

const OPTION =
  "flex items-center gap-3.5 rounded-xl border border-line px-4 py-3.5 text-[15px] font-semibold text-ink transition-[border-color,background-color,transform] duration-300 hover:border-ink/40 hover:bg-canvas active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** Share opens a window: the place, then copy link, email, WhatsApp, SMS, Facebook, X and the phone's own share sheet. */
export function ShareButton({ variant = "text", ...preview }: PlacePreviewData & { variant?: "text" | "icon" }) {
  const t = useTranslations("Listings");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");

  function show() {
    setUrl(window.location.href);
    setCopied(false);
    setOpen(true);
  }

  async function copy() {
    await navigator.clipboard?.writeText(url);
    setCopied(true);
  }

  const message = t("shareMessage", { title: preview.title });
  const u = encodeURIComponent(url);
  const text = encodeURIComponent(`${message} ${url}`);
  const links: { label: string; href: string; icon: ReactNode; external?: boolean }[] = [
    { label: t("shareEmail"), href: `mailto:?subject=${encodeURIComponent(preview.title)}&body=${text}`, icon: <Mail className="size-5" aria-hidden="true" /> },
    { label: t("shareWhatsApp"), href: `https://wa.me/?text=${text}`, icon: <WhatsAppIcon />, external: true },
    { label: t("shareMessages"), href: `sms:?&body=${text}`, icon: <MessageSquare className="size-5" aria-hidden="true" /> },
    { label: t("shareFacebook"), href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, icon: <FacebookIcon />, external: true },
    { label: t("shareX"), href: `https://x.com/intent/post?text=${encodeURIComponent(message)}&url=${u}`, icon: <XIcon />, external: true },
  ];

  return (
    <>
      {variant === "icon" ? (
        <button type="button" onClick={show} aria-label={t("share")} className="flex size-10 items-center justify-center rounded-full bg-white/95 text-ink shadow-[0_4px_14px_rgba(0,0,0,0.25)] backdrop-blur transition-transform duration-200 active:scale-90">
          <Share className="size-[18px]" aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          onClick={show}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-ink underline underline-offset-4 transition-colors hover:bg-canvas"
        >
          <Share className="size-4" aria-hidden="true" />
          {t("share")}
        </button>
      )}
      {open && (
        <Modal title={t("shareTitle")} closeLabel={t("close")} onClose={() => setOpen(false)} className="md:max-w-lg">
          <PlacePreview {...preview} />
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="button" onClick={copy} className={cn(OPTION, copied && "border-success/60")}>
              {copied ? <Check className="size-5 text-success" aria-hidden="true" /> : <Copy className="size-5" aria-hidden="true" />}
              <span aria-live="polite">{copied ? t("linkCopied") : t("copyLink")}</span>
            </button>
            {links.map(({ label, href, icon, external }) => (
              <a key={label} href={href} className={OPTION} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {icon}
                {label}
              </a>
            ))}
            {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
              <button
                type="button"
                onClick={() => navigator.share({ title: preview.title, text: message, url }).catch(() => {})}
                className={OPTION}
              >
                <Ellipsis className="size-5" aria-hidden="true" />
                {t("moreOptions")}
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
