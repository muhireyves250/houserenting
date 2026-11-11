"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

/** Round back button: the previous page, or home when the page was opened directly. */
export function BackButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
      className="flex size-11 items-center justify-center rounded-full bg-white text-ink shadow-[0_6px_16px_-8px_rgba(0,30,80,0.5)] transition-transform active:scale-95"
    >
      <ArrowLeft className="size-5" aria-hidden="true" />
    </button>
  );
}
