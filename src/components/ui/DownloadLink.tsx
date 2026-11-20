"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Downloads a file from our own API and saves it, also inside the installed app and phone browsers (where a plain
 * link to a file can do nothing). Shows a spinner while it comes, and says so when it fails.
 */
export function DownloadLink({
  href,
  filename,
  children,
  className,
  icon = true,
  errorLabel = "Download failed — try again",
}: {
  href: string;
  /** Default: the name the server gives the file. */
  filename?: string;
  children: ReactNode;
  className?: string;
  icon?: boolean;
  errorLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const save = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(href, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(String(res.status));
      const named = /filename="?([^";]+)"?/.exec(
        res.headers.get("content-disposition") ?? "",
      )?.[1];
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? named ?? "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <a
      href={href}
      download={filename ?? true}
      onClick={save}
      aria-busy={busy}
      className={cn(className, failed && "border-danger text-danger")}
      title={failed ? errorLabel : undefined}
    >
      {icon &&
        (busy ? (
          <LoaderCircle
            className="size-3.5 shrink-0 animate-spin"
            aria-hidden="true"
          />
        ) : (
          <Download
            className="size-3.5 shrink-0 max-sm:hidden"
            aria-hidden="true"
          />
        ))}
      {failed ? errorLabel : children}
    </a>
  );
}
