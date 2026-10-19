import { cn } from "@/lib/cn";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = Array.from(parts[0])[0];
  const last = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] : "";
  return (first + last).toUpperCase();
}

/** The person's photo when they added one, otherwise their initials. Decorative: the name is always next to it. */
export function Avatar({ name, image, className }: { name: string; image?: string | null; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-sm font-semibold text-primary", className)}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- small same-site photo, already sized
        <img src={image} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" decoding="async" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
