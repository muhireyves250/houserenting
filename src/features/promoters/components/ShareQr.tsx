"use client";

import { Check, Copy, Download, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** The QR code drawn as a picture (PNG) with white space around it, so it scans well when printed or forwarded. */
async function qrPng(svg: string, size = 720): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("qr"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    const pad = size * 0.06;
    ctx.drawImage(img, pad, pad, size - pad * 2, size - pad * 2);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Share a QR code: the phone's share sheet with the picture and the link (WhatsApp, SMS…), or download it, or copy
 * the link. Where sharing pictures isn't possible, the link is shared instead.
 */
export function ShareQr({ svg, link, text, filename }: { svg: string; link: string; text: string; filename: string }) {
  const t = useTranslations("Promoters.shareQr");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const btn =
    "inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-60";

  const share = async () => {
    setBusy(true);
    try {
      const file = new File([await qrPng(svg)], `${filename}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: `${text}\n${link}` });
      else if (navigator.share) await navigator.share({ text, url: link });
      else await copy();
    } catch {
      // Closed the share sheet, or sharing isn't allowed here: nothing to do.
    } finally {
      setBusy(false);
    }
  };
  const download = async () => {
    const url = URL.createObjectURL(await qrPng(svg));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link is shown on the page to copy by hand.
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={share} disabled={busy} className={`${btn} bg-primary text-white hover:bg-primary-hover`}>
        <Share2 className="size-4" aria-hidden="true" />
        {t("share")}
      </button>
      <button type="button" onClick={download} className={`${btn} border border-line bg-surface text-ink hover:border-primary`}>
        <Download className="size-4" aria-hidden="true" />
        {t("download")}
      </button>
      <button type="button" onClick={copy} className={`${btn} border border-line bg-surface text-ink hover:border-primary`}>
        {copied ? <Check className="size-4 text-emerald-600" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        {copied ? t("copied") : t("copy")}
      </button>
    </div>
  );
}
