import type { ReactNode } from "react";

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-16 text-center">
      {icon && (
        // Layered soft rings around the icon: a light illustration without image assets.
        <div className="relative mb-4 flex size-32 items-center justify-center rounded-full bg-primary/[0.05]" aria-hidden="true">
          <div className="absolute inset-4 rounded-full bg-primary/[0.08]" />
          <div className="relative flex size-16 items-center justify-center rounded-2xl bg-surface text-primary shadow-[0_12px_28px_-10px_rgba(0,87,184,0.45)] [&>svg]:size-8">
            {icon}
          </div>
        </div>
      )}
      <h2 className="text-[22px] leading-7 font-bold tracking-[-0.02em] text-ink">{title}</h2>
      <p className="text-[15px] leading-6 text-muted">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
