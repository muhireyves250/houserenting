"use client";

import { X } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";
import { useModal } from "@/lib/use-modal";
import { cn } from "@/lib/cn";

/** Centered dialog over a blurred, dimmed page. Closes on Escape, the ✕ button or a backdrop click. */
export function Modal({
  title,
  closeLabel,
  onClose,
  children,
  className,
}: {
  title: ReactNode;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useModal(dialogRef, onClose);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        data-testid="modal-backdrop"
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-[#00142e]/45 backdrop-blur-[6px] motion-safe:animate-[fade-in_300ms_ease-out]"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[2rem] bg-surface p-8",
          "shadow-[0_30px_80px_-20px_rgba(0,20,60,0.55)] motion-safe:animate-pop-in",
          // Form typography inside dialogs: clear sentence-case labels, slightly larger input text.
          "[&_label]:text-[13px] [&_label]:font-semibold [&_label]:text-ink [&_input]:text-[15px]",
          className,
        )}
      >
        <button
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
          className={cn(
            "group/close absolute top-5 right-5 flex size-10 items-center justify-center rounded-full text-ink",
            "transition-[background-color,color,transform] duration-300 ease-out hover:bg-primary/10 hover:text-primary active:scale-90",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          )}
        >
          <X
            className="size-5 transition-transform duration-300 ease-out group-hover/close:rotate-90 motion-reduce:transition-none motion-reduce:group-hover/close:rotate-0"
            aria-hidden="true"
          />
        </button>
        <h2 id={titleId} className="mb-6 px-10 text-center text-[28px] leading-tight font-bold tracking-tight text-ink">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
