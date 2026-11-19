"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";

/**
 * A staff form opened over the list it came from (add or edit a place or restaurant): a large window on
 * computers, a full-screen sheet on phones. Closing (✕, Esc, the back button, a tap outside) goes back to the list.
 */
export function AdminModal({ children }: { children: ReactNode }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && router.back();
    document.addEventListener("keydown", onKey);
    // The page behind stays still while the window scrolls.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [router]);

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center md:items-center md:p-6" role="dialog" aria-modal="true">
      <div aria-hidden="true" onClick={() => router.back()} className="absolute inset-0 bg-[#00142e]/45 backdrop-blur-[3px] motion-safe:animate-[fade-in_200ms_ease-out]" />
      <div
        ref={panel}
        tabIndex={-1}
        className="admin-modal admin-cards relative flex w-full flex-col overflow-hidden bg-canvas outline-none md:h-[min(92dvh,1000px)] md:max-w-5xl md:rounded-3xl md:shadow-[0_30px_80px_-20px_rgba(0,20,46,0.55)]"
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t("closeWindow")}
          className="absolute top-3 right-3 z-20 flex size-10 items-center justify-center rounded-full bg-surface text-ink shadow-md ring-1 ring-line transition-colors hover:bg-canvas"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-8 md:px-8 md:pt-6">{children}</div>
      </div>
    </div>
  );
}
