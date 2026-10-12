import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TextFieldProps = Omit<ComponentProps<"input">, "id"> & {
  label: string;
  icon?: ReactNode;
  error?: string;
  hint?: string;
  id?: string;
  hideLabel?: boolean;
  trailing?: ReactNode;
};

export function TextField({ label, icon, error, hint, id, hideLabel = false, trailing, className, ...props }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const descriptionId = `${inputId}-description`;
  const description = error ?? hint;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={inputId} className={cn("text-sm text-muted", hideLabel && "sr-only")}>
        {label}
      </label>
      <div
        className={cn(
          "flex items-center gap-3 border-b py-2 transition-colors focus-within:border-primary",
          error ? "border-danger" : "border-line",
        )}
      >
        {icon && (
          <span className="text-muted [&>svg]:size-5" aria-hidden="true">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted"
          aria-invalid={error ? true : undefined}
          aria-describedby={description ? descriptionId : undefined}
          {...props}
        />
        {trailing}
      </div>
      {description && (
        <p id={descriptionId} role={error ? "alert" : undefined} className={cn("text-xs", error ? "text-danger" : "text-muted")}>
          {description}
        </p>
      )}
    </div>
  );
}
