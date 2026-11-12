import type { ReactNode } from "react";

/** A section of a place's page: a line above, a title, its content. */
export function DetailSection({ title, children, id }: { title?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-reveal scroll-mt-24 border-t border-line py-10">
      {title && <h2 className="mb-6 font-display text-[22px] leading-7 font-bold tracking-[-0.02em] text-ink">{title}</h2>}
      {children}
    </section>
  );
}
