import { cn } from "@/lib/cn";
import type { PersonRole } from "../service";

/** A person's one role, as a small badge (VIIPA staff in blue, places and restaurants in their own colours). */
export function RoleBadge({ role, label }: { role: PersonRole; label: string }) {
  const tone = role.startsWith("STAFF_") ? "bg-primary/10 text-primary" : role.startsWith("PLACE_") ? "bg-emerald-50 text-emerald-800" : role.startsWith("RESTAURANT_") ? "bg-amber-50 text-amber-900" : "bg-canvas text-ink/70";
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", tone)}>{label}</span>;
}
