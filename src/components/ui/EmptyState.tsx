import type { ReactNode } from "react";

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-16 text-center">
      {icon && (
        <div className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary [&>svg]:size-7" aria-hidden="true">
          {icon}
        </div>
      )}
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="text-sm text-muted">{body}</p>
      {action}
    </div>
  );
}
