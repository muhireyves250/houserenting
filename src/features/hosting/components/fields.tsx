import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const box =
  "flex flex-col gap-0.5 rounded-xl border bg-surface px-4 py-2.5 transition-colors focus-within:border-ink max-md:focus-within:border-primary";

/** Bordered input with a small label inside, like the mobile money field in the Reserve window. */
export function Field({
  label,
  error,
  className,
  ...props
}: { label: string; error?: string; className?: string } & Omit<ComponentProps<"input">, "className">) {
  const id = useId();
  return (
    <div className={className}>
      <div className={cn(box, error ? "border-danger" : "border-line-strong")}>
        <label htmlFor={id} className="text-xs font-semibold text-muted">
          {label}
        </label>
        <input id={id} aria-invalid={error ? true : undefined} className="w-full bg-transparent text-[15px] text-ink outline-none" {...props} />
      </div>
      {error && (
        <p role="alert" className="mt-1 text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function AreaField({
  label,
  error,
  className,
  ...props
}: { label: string; error?: string; className?: string } & Omit<ComponentProps<"textarea">, "className">) {
  const id = useId();
  return (
    <div className={className}>
      <div className={cn(box, error ? "border-danger" : "border-line-strong")}>
        <label htmlFor={id} className="text-xs font-semibold text-muted">
          {label}
        </label>
        <textarea id={id} aria-invalid={error ? true : undefined} className="min-h-24 w-full resize-y bg-transparent text-[15px] text-ink outline-none" {...props} />
      </div>
      {error && (
        <p role="alert" className="mt-1 text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  children,
  className,
  ...props
}: { label: string; children: ReactNode; className?: string } & Omit<ComponentProps<"select">, "className">) {
  const id = useId();
  return (
    <div className={cn(box, "border-line-strong", className)}>
      <label htmlFor={id} className="text-xs font-semibold text-muted">
        {label}
      </label>
      <select id={id} className="-ml-1 w-full cursor-pointer bg-transparent text-[15px] text-ink outline-none" {...props}>
        {children}
      </select>
    </div>
  );
}

/** Rounded on/off chip (amenities, ways of renting). */
export function Chip({ on, onToggle, children }: { on: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={cn(
        "rounded-full border px-4 py-2 text-sm transition-colors duration-200",
        on ? "border-primary bg-primary/[0.08] font-semibold text-primary" : "border-line text-ink hover:border-primary/60",
      )}
    >
      {children}
    </button>
  );
}

export function Card({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-3xl bg-surface p-5 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line md:p-6">
      <h2 className="mb-4 text-lg font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}
