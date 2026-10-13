"use client";

import { X } from "lucide-react";
import { useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  // The portal needs <body>: render it only in the browser (direct /login visits are server-rendered first).
  const inBrowser = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!inBrowser) return null;
  return <ModalDialog title={title} closeLabel={closeLabel} onClose={onClose} className={className}>{children}</ModalDialog>;
}

/** The dialog itself; mounted only in the browser so focus, Escape and scroll lock attach to a real element. */
function ModalDialog({
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

  // Portalled to <body> so no positioned parent (e.g. buttons over a photo) can trap it under the page.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center md:p-4">
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
          // Phones: a bottom sheet rising from the bottom edge. Larger screens: a centred card.
          "relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] motion-safe:animate-sheet-up",
          "md:max-h-[calc(100dvh-2rem)] md:max-w-md md:rounded-[2rem] md:p-8 md:motion-safe:animate-pop-in",
          "shadow-[0_30px_80px_-20px_rgba(0,20,60,0.55)]",
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
    </div>,
    document.body,
  );
}
